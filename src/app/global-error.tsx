'use client'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// This is the one error boundary that must define its own <html>/<body> —
// it only fires when the root layout itself throws, which means the layout
// (and everything inside it, including ErrorFallback's own dependencies)
// can't be trusted to render. Kept intentionally plain and dependency-free.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', textAlign: 'center', padding: '24px', gap: '12px',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: '#fef2f2', color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle width={28} height={28} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 360 }}>
            The app hit an unexpected error while loading. Your data is safe — try again.
          </p>
          <button onClick={reset} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', marginTop: 8,
            background: '#2563eb', color: 'white', border: 'none', borderRadius: 12,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            <RefreshCw width={16} height={16} /> Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
