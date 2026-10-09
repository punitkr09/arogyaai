import React from 'react'
import type { TimelineEvent } from '../types/workflow'

interface TimelineViewProps {
  timeline: TimelineEvent[]
}

export const TimelineView: React.FC<TimelineViewProps> = ({ timeline }) => {
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      })
    } catch {
      return isoString
    }
  }

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'success':
        return 'timeline-level-success'
      case 'warning':
        return 'timeline-level-warning'
      case 'error':
        return 'timeline-level-error'
      default:
        return 'timeline-level-info'
    }
  }

  return (
    <section className="timeline-container">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">3. Activity Timeline</h2>
          <p className="section-desc">
            Granular trace of inter-agent messages, state changes, and verification checkpoints.
          </p>
        </div>
        <span className="badge badge-neutral">
          {timeline.length} Events Logged
        </span>
      </div>

      <div className="timeline-list">
        {timeline.map((event, idx) => (
          <div key={event.id || idx} className="timeline-item">
            <div className="timeline-marker-col">
              <span className={`timeline-dot ${getLevelBadgeClass(event.level)}`} />
              {idx < timeline.length - 1 && <div className="timeline-line" />}
            </div>

            <div className="timeline-content">
              <div className="timeline-header">
                <div className="timeline-tag-group">
                  <span className="timeline-stage-tag">{event.stage}</span>
                  <span className={`timeline-level-tag ${getLevelBadgeClass(event.level)}`}>
                    {event.level.toUpperCase()}
                  </span>
                </div>
                <time className="timeline-timestamp">{formatTime(event.timestamp)}</time>
              </div>

              <div className="timeline-message">{event.message}</div>

              {event.details && (
                <div className="timeline-details-box">
                  <code>{event.details}</code>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
