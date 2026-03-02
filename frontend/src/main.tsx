import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSentry, SentryErrorBoundary } from './lib/sentry.ts'

// Initialize Sentry before rendering the app
initSentry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SentryErrorBoundary
      fallback={
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>We've been notified and are working on a fix.</p>
          <button onClick={() => window.location.reload()}>Reload page</button>
        </div>
      }
    >
      <App />
    </SentryErrorBoundary>
  </React.StrictMode>,
)
