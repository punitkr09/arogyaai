# Multi-stage production Dockerfile for Arogya AI FastAPI Backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy application code and dataset CSVs
COPY backend /app/backend
COPY data /app/data

ENV PYTHONUNBUFFERED=1
ENV APP_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000

# Run uvicorn server
CMD ["sh", "-c", "uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8000}"]
