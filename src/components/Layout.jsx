import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import CreateUserModal from './CreateUserModal'
import { Menu } from 'lucide-react'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [createUserOpen, setCreateUserOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenCreateUser={() => setCreateUserOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar móvil */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-pizarra-800 bg-pizarra-950/90 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-pizarra-800 text-pizarra-400"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-pizarra-100">TaxiControl</span>
        </header>

        {/* Contenido principal */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Modal de crear usuario (solo lo abre el admin desde el Sidebar) */}
      <CreateUserModal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
      />
    </div>
  )
}
