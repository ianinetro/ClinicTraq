import React from 'react'

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: '40px 32px', maxWidth: 560, margin: '60px auto',
          background: 'white', border: '1px solid #FECACA',
          borderRadius: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#12122C', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: '#6B6B8A', marginBottom: 20 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              height: 36, padding: '0 20px', borderRadius: 8,
              background: '#0410BD', color: 'white', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 8,
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              height: 36, padding: '0 20px', borderRadius: 8,
              background: 'white', color: '#374151',
              border: '1px solid #E0E0EF',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Go to Dashboard
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
