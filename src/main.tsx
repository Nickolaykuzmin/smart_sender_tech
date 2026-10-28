import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { setupWorker } from 'msw/browser'
import { MantineProvider } from '@mantine/core'
import { createHandlers } from './mocks/handlers'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { WebhooksPage } from './pages/WebhooksPage'
import '@mantine/core/styles.css'

// Retries are done in the API client.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

await setupWorker(...createHandlers()).start({ onUnhandledRequest: 'bypass' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/webhooks"
                element={
                  <RequireAuth>
                    <WebhooksPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/webhooks" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
)
