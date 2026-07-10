import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import { AppErrorBoundary } from '@/components/error-boundary'
import { initAnalytics, initObservability } from '@/lib/observability'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Coming back to the tab is exactly when a client wants fresh case
      // state — refetch on focus (staleTime still debounces to 15s).
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  },
})

async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
}

async function bootstrap(): Promise<void> {
  await enableMocking()
  initObservability()
  initAnalytics()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          gap={8}
          toastOptions={{
            style: {
              background: 'var(--color-snow)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-rule)',
              boxShadow: 'var(--shadow-editorial)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.875rem',
              letterSpacing: '-0.012em',
            },
          }}
        />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
