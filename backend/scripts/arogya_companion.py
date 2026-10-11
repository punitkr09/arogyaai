#!/usr/bin/env python3
"""
Arogya AI — Local Companion Helper Service
============================================
Lightweight, secure loopback bridge connecting browser-based frontend
(e.g., deployed on Vercel) to local Ollama inference instances.

Key Security Guarantees:
1. Binds strictly to loopback (127.0.0.1) — never listens on 0.0.0.0.
2. Restricts CORS strictly to authorized origins (localhost and *.vercel.app).
3. Adds Chrome Private Network Access (PNA) preflight headers.
4. Optional TLS/HTTPS mode with self-signed certificate generation.
5. Zero external pip dependencies (uses Python standard library).
"""

import argparse
import http.server
import json
import os
import re
import socketserver
import ssl
import sys
import urllib.error
import urllib.request
from typing import List, Optional

VERSION = "1.0.0"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 11435
DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"

# Default allowed origin patterns
ALLOWED_ORIGIN_PATTERNS = [
    r"^http:\/\/localhost(:\d+)?$",
    r"^http:\/\/127\.0\.0\.1(:\d+)?$",
    r"^https:\/\/localhost(:\d+)?$",
    r"^https:\/\/127\.0\.0\.1(:\d+)?$",
    r"^https:\/\/.*\.vercel\.app$",
]


class ArogyaCompanionHandler(http.server.BaseHTTPRequestHandler):
    ollama_url: str = DEFAULT_OLLAMA_URL
    custom_allowed_origins: List[str] = []

    def log_message(self, format, *args):
        # Concise logging
        sys.stderr.write(f"[{self.log_date_time_string()}] [Companion] {format % args}\n")

    @classmethod
    def _is_origin_allowed(cls, origin: str) -> bool:
        if not origin:
            return False
        origin_clean = origin.strip().rstrip("/")
        # Check custom allowed origins
        for allowed in cls.custom_allowed_origins:
            if allowed.rstrip("/") == origin_clean:
                return True
        # Check default pattern regexes
        for pattern in ALLOWED_ORIGIN_PATTERNS:
            if re.match(pattern, origin_clean):
                return True
        return False

    def _send_cors_headers(self, origin: Optional[str] = None):
        request_origin = origin or self.headers.get("Origin", "")
        if self._is_origin_allowed(request_origin):
            self.send_header("Access-Control-Allow-Origin", request_origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")
        else:
            # For local non-browser tools
            self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:11435")

        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, Accept, X-Requested-With, Access-Control-Request-Private-Network",
        )
        # Chrome Private Network Access header
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        """Handle CORS and Private Network Access preflights."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")

        if path in ["", "/health", "/status"]:
            # Self-health check
            ollama_reachable = False
            available_models = []
            try:
                req = urllib.request.Request(f"{self.ollama_url}/api/tags")
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    if resp.status == 200:
                        ollama_reachable = True
                        data = json.loads(resp.read().decode("utf-8"))
                        available_models = [m.get("name") for m in data.get("models", []) if m.get("name")]
            except Exception:
                pass

            response_data = {
                "service": "arogya-ai-companion",
                "version": VERSION,
                "status": "online",
                "bind_host": DEFAULT_HOST,
                "loopback_only": True,
                "ollama_target": self.ollama_url,
                "ollama_reachable": ollama_reachable,
                "installed_models": available_models,
            }
            body = json.dumps(response_data, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path in ["/api/tags", "/api/version"]:
            self._proxy_to_ollama("GET", path)
            return

        self.send_error(404, f"Endpoint {path} not supported by Arogya companion.")

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")

        if path in ["/api/chat", "/api/generate"]:
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length) if content_length > 0 else b"{}"
            self._proxy_to_ollama("POST", path, body_bytes)
            return

        self.send_error(404, f"Endpoint {path} not supported by Arogya companion.")

    def _proxy_to_ollama(self, method: str, path: str, body_bytes: Optional[bytes] = None):
        target_url = f"{self.ollama_url}{path}"
        try:
            req = urllib.request.Request(
                target_url,
                data=body_bytes if method == "POST" else None,
                method=method,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=45.0) as resp:
                resp_bytes = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self._send_cors_headers()
                self.send_header("Content-Length", str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
        except urllib.error.HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.send_header("Content-Length", str(len(err_body)))
            self.end_headers()
            self.wfile.write(err_body)
        except Exception as e:
            err_json = json.dumps({
                "error": "Failed to proxy request to local Ollama service",
                "detail": str(e),
                "ollama_target": self.ollama_url,
            }).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.send_header("Content-Length", str(len(err_json)))
            self.end_headers()
            self.wfile.write(err_json)


def generate_self_signed_cert(cert_path: str, key_path: str):
    """Generates a self-signed certificate for localhost using OpenSSL if available."""
    import subprocess
    cmd = [
        "openssl", "req", "-x509", "-newkey", "rsa:2048",
        "-keyout", key_path, "-out", cert_path, "-days", "365",
        "-nodes", "-subj", "/CN=127.0.0.1",
        "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost",
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def run_companion():
    parser = argparse.ArgumentParser(description="Arogya AI Local Companion Service")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Host to bind (default: 127.0.0.1 loopback only)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to listen on (default: 11435)")
    parser.add_argument("--ollama-url", default=DEFAULT_OLLAMA_URL, help="Local Ollama URL (default: http://127.0.0.1:11434)")
    parser.add_argument("--allow-origin", action="append", default=[], help="Additional allowed CORS origin")
    parser.add_argument("--ssl", action="store_true", help="Enable HTTPS mode with local self-signed certificate")
    args = parser.parse_args()

    # Enforce loopback binding for security
    if args.host not in ["127.0.0.1", "localhost", "::1"]:
        print(f"[ERROR] Security violation: Companion must bind strictly to loopback (127.0.0.1). Specified: {args.host}")
        sys.exit(1)

    ArogyaCompanionHandler.ollama_url = args.ollama_url.rstrip("/")
    ArogyaCompanionHandler.custom_allowed_origins = args.allow_origin

    protocol = "https" if args.ssl else "http"
    print("=" * 70)
    print("  AROGYA AI — LOCAL COMPANION SERVICE")
    print("  Zero-Dependency Loopback AI Bridge")
    print("=" * 70)
    print(f"  • Listening on:      {protocol}://{args.host}:{args.port}")
    print(f"  • Upstream Ollama:   {args.ollama_url}")
    print(f"  • Bind Mode:         Loopback Only (Safe, never exposed to LAN/WAN)")
    print(f"  • PNA Headers:       Active (Access-Control-Allow-Private-Network)")
    print(f"  • Allowed Origins:   localhost, 127.0.0.1, *.vercel.app")
    if args.allow_origin:
        print(f"  • Custom Origins:    {', '.join(args.allow_origin)}")
    print("=" * 70)
    print("Health check endpoint: http://127.0.0.1:11435/health")
    print("Press Ctrl+C to stop.\n")

    handler = ArogyaCompanionHandler
    httpd = socketserver.TCPServer((args.host, args.port), handler)

    if args.ssl:
        cert_file = os.path.expanduser("~/.arogya_cert.pem")
        key_file = os.path.expanduser("~/.arogya_key.pem")
        if not (os.path.exists(cert_file) and os.path.exists(key_file)):
            print("[INFO] Generating self-signed localhost certificate...")
            try:
                generate_self_signed_cert(cert_file, key_file)
            except Exception as e:
                print(f"[WARN] Failed to auto-generate certificate via OpenSSL: {e}")
                sys.exit(1)

        ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ctx.load_cert_chain(certfile=cert_file, keyfile=key_file)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        print(f"[INFO] TLS enabled using {cert_file}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Companion stopped gracefully.")
        httpd.server_close()


if __name__ == "__main__":
    run_companion()
