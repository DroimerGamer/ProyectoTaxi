import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Unidades from '@/pages/Unidades'
import Ingresos from '@/pages/Ingresos'
import Gastos from '@/pages/Gastos'
import Pendientes from '@/pages/Pendientes'
import ResumenSemanal from '@/pages/ResumenSemanal'
import ResumenSemanalV2 from '@/pages/ResumenSemanalV2'
import Mantenimiento from '@/pages/Mantenimiento'
import Deudas from '@/pages/Deudas'
import { Toaster } from 'react-hot-toast'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#0f172a' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#0f172a' } },
          }}
        />

        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="unidades" element={<Unidades />} />
            <Route path="ingresos" element={<Ingresos />} />
            <Route path="gastos" element={<Gastos />} />
            <Route path="pendientes" element={<Pendientes />} />
            <Route path="resumen" element={<ResumenSemanal />} />
            <Route path="resumen-v2" element={<ResumenSemanalV2 />} />
            <Route path="mantenimiento" element={<Mantenimiento />} />
            <Route path="deudas" element={<Deudas />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
