import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useAudioCapture } from '../hooks/useAudioCapture'
import { useAnalysisPipeline } from '../hooks/useAnalysisPipeline'
import { useAppStore } from '../store/appStore'
import { SignalMeter } from '../components/SignalMeter'
import { SpectrumAnalyzer } from '../components/SpectrumAnalyzer'
import { IssueList } from '../components/IssueList'
import { RecommendationPanel } from '../components/RecommendationPanel'
import { MixerInstructions } from '../components/MixerInstructions'
import { SessionLogger } from '../analysis/SessionLogger'
import { SOURCE_TYPE_LABELS } from '@shared/types'

/** Formats elapsed milliseconds as mm:ss */
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function LiveScreen(): React.ReactElement {
  const [error, setError]         = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const loggerRef   = useRef<SessionLogger>(new SessionLogger())

  const isCapturing      = useAppStore(s => s.isCapturing)
  const session          = useAppStore(s => s.session)
  const snapshot         = useAppStore(s => s.analysisSnapshot)
  const setSuggestionMode = useAppStore(s => s.setSuggestionMode)

  const { startCapture, stopCapture } = useAudioCapture()
  // onFrame is now stable (empty deps) — safe to use in effects
  const { onFrame, latestResultRef }  = useAnalysisPipeline()

  // ── Session timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isCapturing) {
      setElapsedMs(0)
      timerRef.current = setInterval(() => setElapsedMs(ms => ms + 1000), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isCapturing])

  // ── Log snapshots for session summary ──────────────────────────────────────
  useEffect(() => {
    if (snapshot && isCapturing) {
      loggerRef.current.log(snapshot)
    }
  }, [snapshot, isCapturing])

  // ── Auto-start on mount (device must be selected on Setup screen) ──────────
  // Intentional empty dep array: we only auto-start once. If the user wants to
  // change device, they go back to Setup. The stop cleanup runs on unmount.
  // onFrame is stable (guaranteed by useAnalysisPipeline), so this is safe.
  useEffect(() => {
    if (session.selectedDeviceId) {
      handleStart()
    }
    return () => {
      stopCapture()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(async (): Promise<void> => {
    setError(null)
    loggerRef.current.clear()
    try {
      await startCapture(onFrame)
      // Begin the listening window immediately after audio capture starts
      setSuggestionMode('listening')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Microphone permission denied. Check your system audio settings.')
      } else if (msg.includes('NotFound') || msg.includes('device')) {
        setError('Audio device not found. Return to Setup and reselect your input.')
      } else {
        setError(`Could not start audio capture: ${msg}`)
      }
    }
  }, [startCapture, onFrame])

  const handleStop = useCallback(async (): Promise<void> => {
    await stopCapture()
  }, [stopCapture])

  const summary = showSummary ? loggerRef.current.getSummary() : null

  return (
    <div className="screen live-screen">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="live-topbar">
        <div className="live-topbar__info">
          <span className="live-info-chip">
            {SOURCE_TYPE_LABELS[session.selectedSourceType]}
          </span>
          {session.selectedMixerProfileId ? (
            <span className="live-info-chip">CH {session.channelNumber}</span>
          ) : (
            <span className="live-info-chip live-info-chip--muted">No mixer selected</span>
          )}
          {isCapturing && (
            <span className="live-info-chip live-info-chip--timer">
              ⏱ {formatDuration(elapsedMs)}
            </span>
          )}
          {isCapturing && snapshot && (
            <span className={`live-info-chip ${
              snapshot.clippingRisk
                ? 'live-info-chip--clip'
                : snapshot.signalPresent
                  ? 'live-info-chip--ok'
                  : 'live-info-chip--muted'
            }`}>
              {snapshot.clippingRisk
                ? '⚠ CLIP'
                : snapshot.signalPresent
                  ? `${snapshot.levelDb.toFixed(1)} dBFS`
                  : 'No signal'}
            </span>
          )}
        </div>

        <div className="live-topbar__controls">
          {isCapturing && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setShowSummary(s => !s)}
              title="Session summary"
            >
              {showSummary ? 'Hide Summary' : 'Session Summary'}
            </button>
          )}
          {!isCapturing ? (
            <button className="btn btn--primary" onClick={handleStart}>
              ▶ Start Analysis
            </button>
          ) : (
            <button className="btn btn--danger" onClick={handleStop}>
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
          <button className="error-banner__retry" onClick={handleStart}>Retry</button>
        </div>
      )}

      {/* ── Session summary overlay ───────────────────────────────────────── */}
      {showSummary && summary && (
        <div className="session-summary">
          <div className="session-summary__header">
            Session Summary — {formatDuration(summary.durationMs)} · {summary.totalEntries} samples
          </div>
          <div className="session-summary__stats">
            <div className="session-summary__stat">
              <span className="session-summary__stat-label">Avg Level</span>
              <span className="session-summary__stat-value">{summary.averageLevelDb} dBFS</span>
            </div>
            <div className="session-summary__stat">
              <span className="session-summary__stat-label">Peak</span>
              <span className="session-summary__stat-value">{summary.peakLevelDb} dBFS</span>
            </div>
          </div>
          {Object.keys(summary.issuePercent).length > 0 && (
            <div className="session-summary__issues">
              <span className="session-summary__issues-label">Issues by frequency:</span>
              {(Object.entries(summary.issuePercent) as [string, number][])
                .sort(([,a],[,b]) => b - a)
                .map(([type, pct]) => (
                  <div key={type} className="session-summary__issue-row">
                    <span className="session-summary__issue-name">{type.replace('_', ' ')}</span>
                    <div className="session-summary__issue-bar-wrap">
                      <div className="session-summary__issue-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="session-summary__issue-pct">{pct}%</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Main analysis area ────────────────────────────────────────────── */}
      <div className="live-main">
        <div className="live-meter-col">
          <SignalMeter />
        </div>

        <div className="live-center-col">
          <SpectrumAnalyzer latestResultRef={latestResultRef} width={560} height={160} />

          {/* Band energy table */}
          {snapshot?.signalPresent && (
            <div className="band-table">
              {([
                { label: 'Sub',      value: snapshot.bands.subBass  },
                { label: 'Bass',     value: snapshot.bands.bass     },
                { label: 'Lo-Mid',   value: snapshot.bands.lowMid   },
                { label: 'Mid',      value: snapshot.bands.mid      },
                { label: 'Hi-Mid',   value: snapshot.bands.upperMid },
                { label: 'Presence', value: snapshot.bands.presence },
                { label: 'High',     value: snapshot.bands.high     }
              ] as { label: string; value: number }[]).map(({ label, value }) => (
                <div key={label} className="band-cell">
                  <span className="band-cell__label">{label}</span>
                  <span className={`band-cell__value ${value > -35 ? 'band-cell__value--active' : ''}`}>
                    {value > -90 ? `${Math.round(value)}` : '—'}
                  </span>
                  <span className="band-cell__unit">dB</span>
                </div>
              ))}
            </div>
          )}

          {/* No-device warning */}
          {!session.selectedDeviceId && !isCapturing && (
            <div className="live-no-device">
              No audio input selected. Go to{' '}
              <button
                className="live-no-device__link"
                onClick={() => useAppStore.getState().navigateTo('setup')}
              >
                Setup
              </button>
              {' '}to choose an input device.
            </div>
          )}
        </div>
      </div>

      {/* ── Lower panels ─────────────────────────────────────────────────── */}
      <div className="live-panels">
        <IssueList />
        <RecommendationPanel />
        <MixerInstructions />
      </div>
    </div>
  )
}
