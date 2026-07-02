import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { Toaster } from 'sonner'
import { seedContact, MOCK_SESSION_JWT } from '@/mocks/fixtures'
import { useSessionStore } from '@/stores/session'

/** Sign the fixture contact in (store + localStorage), as after a magic link. */
export function seedSession(): void {
  useSessionStore.getState().login(MOCK_SESSION_JWT, seedContact)
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface RenderOptions {
  /** Initial URL, e.g. `/cases/case-0001`. */
  route?: string
  /** Route pattern the ui is mounted at, e.g. `/cases/:id`. */
  path?: string
  queryClient?: QueryClient
}

// Stub destinations so navigation away from the component under test has
// somewhere to land (assertable via the marker text).
const STUB_ROUTES = ['/login', '/cases', '/cases/new', '/cases/:id']

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path = '/', queryClient = createTestQueryClient() }: RenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={children} />
            {STUB_ROUTES.filter((stub) => stub !== path).map((stub) => (
              <Route key={stub} path={stub} element={<div>stub:{stub}</div>} />
            ))}
          </Routes>
        </MemoryRouter>
        <Toaster />
      </QueryClientProvider>
    )
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) }
}
