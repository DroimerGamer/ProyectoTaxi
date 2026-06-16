import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard,
  Car,
  TrendingUp,
  TrendingDown,
  ClipboardCheck,
  CalendarRange,
  Wrench,
  LogOut,
  X,
  ChevronRight,
  UserPlus,
  HandCoins,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',              label: 'Dashboard',           icon: LayoutDashboard },
  { to: '/resumen',       label: 'Resumen Semanal',     icon: CalendarRange },
  { to: '/ingresos',      label: 'Ingresos',            icon: TrendingUp },
  { to: '/gastos',        label: 'Gastos',              icon: TrendingDown },
  { to: '/deudas',        label: 'Deudas',              icon: HandCoins },
]

export default function Sidebar({ open, onClose, onOpenCreateUser }) {
  const { perfil, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
  await signOut()
}

  return (
    <>
      {/* Overlay móvil */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-pizarra-900/95 backdrop-blur-xl
          border-r border-pizarra-700/50 z-50
          flex flex-col
          transition-transform duration-300 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-pizarra-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-taxi-500 flex items-center justify-center">
              <Car className="w-5 h-5 text-pizarra-900" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-pizarra-50 leading-tight">
                TaxiControl
              </h1>
              <p className="text-[11px] text-pizarra-500 font-medium tracking-wide uppercase">
                Flotilla
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-pizarra-700/50 text-pizarra-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-taxi-500/10 text-taxi-400 border border-taxi-500/20'
                        : 'text-pizarra-400 hover:text-pizarra-200 hover:bg-pizarra-800/60 border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-taxi-400' : 'text-pizarra-500 group-hover:text-pizarra-300'}`} />
                      <span className="flex-1">{label}</span>
                      {isActive && <ChevronRight className="w-4 h-4 text-taxi-500/60" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer — perfil + acciones */}
        <div className="border-t border-pizarra-700/50 p-4">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-lg bg-pizarra-700 flex items-center justify-center text-sm font-bold text-pizarra-300">
              {perfil?.nombre?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-pizarra-200 truncate">
                {perfil?.nombre || 'Usuario'}
              </p>
              <p className="text-[11px] text-pizarra-500 capitalize">
                {perfil?.rol || 'sin rol'}
              </p>
            </div>
          </div>

          {/* Botón crear usuario — solo visible para administradora */}
          {isAdmin && (
            <button
              onClick={() => {
                onClose()
                onOpenCreateUser()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-xl text-sm text-taxi-400 hover:bg-taxi-500/10 border border-transparent hover:border-taxi-500/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Nuevo usuario
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-pizarra-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
