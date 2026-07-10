import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { AuthGate } from '@/features/auth/auth-gate'
import { LoginPage } from '@/features/auth/login-page'
import { LoginCallbackPage } from '@/features/auth/callback-page'
import { CasesListPage } from '@/features/cases/cases-list-page'
import { CaseCreatePage } from '@/features/cases/case-create-page'
import { CaseDetailPage } from '@/features/cases/case-detail-page'
import { NotFoundPage } from '@/features/not-found-page'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/callback" element={<LoginCallbackPage />} />

      <Route element={<AuthGate />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/cases" replace />} />
          <Route path="/cases" element={<CasesListPage />} />
          <Route path="/cases/new" element={<CaseCreatePage />} />
          <Route path="/cases/:id" element={<CaseDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
