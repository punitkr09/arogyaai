import React from 'react'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry, onDismiss }) => {
  return (
    <div className="error-banner">
      <div className="error-icon">✕</div>
      <div className="error-body">
        <h4 className="error-title">Workflow Execution Encountered an Error</h4>
        <p className="error-message">{message}</p>
      </div>
      <div className="error-actions">
        {onRetry && (
          <button type="button" className="btn-error-retry" onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" className="btn-icon-dismiss" onClick={onDismiss} aria-label="Dismiss error">
            ×
          </button>
        )}
      </div>
    </div>
  )
}
