import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from './Modal'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function CreateUserModal({ open, onClose }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nombre: '',
    rol: 'encargado',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function resetForm() {
    setForm({ email: '', password: '', confirmPassword: '', nombre: '', rol: 'encargado' })
    setError('')
    setSuccess('')
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleCreate() {
    setError('')
    setSuccess('')

    // Validaciones
    if (!form.email || !form.password || !form.nombre) {
      setError('Complete todos los campos obligatorios')
      return
    }

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSaving(true)
    try {
      // Usar signUp de Supabase Auth desde el cliente.
      // Nota: Para que esto funcione sin confirmar email,
      // desactiva "Enable email confirmations" en
      // Supabase → Authentication → Providers → Email.
      //
      // El trigger on_auth_user_created en la BD creará
      // automáticamente el registro en la tabla 'perfiles'
      // usando el metadata que enviamos aquí.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            nombre: form.nombre,
            rol: form.rol,
          },
        },
      })

      if (signUpError) throw signUpError

      // Verificar si el usuario realmente se creó
      // (Supabase puede devolver un user "fake" si ya existe)
      if (data?.user?.identities?.length === 0) {
        throw new Error('Ya existe un usuario con ese correo electrónico')
      }

      setSuccess(`Usuario "${form.nombre}" creado exitosamente. Ya puede iniciar sesión con ${form.email}.`)
      setForm({ email: '', password: '', confirmPassword: '', nombre: '', rol: 'encargado' })
    } catch (err) {
      const msg = err.message || 'Error al crear usuario'
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('Ya existe un usuario con ese correo electrónico')
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Crear nuevo usuario">
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div>
          <label className="label">Nombre completo *</label>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: María García López"
          />
        </div>

        <div>
          <label className="label">Correo electrónico *</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="correo@ejemplo.com"
          />
        </div>

        <div>
          <label className="label">Rol *</label>
          <select
            className="input"
            value={form.rol}
            onChange={(e) => setForm({ ...form, rol: e.target.value })}
          >
            <option value="encargado">Encargado</option>
            <option value="administradora">Administradora</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Contraseña *</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mín. 6 caracteres"
            />
          </div>
          <div>
            <label className="label">Confirmar contraseña *</label>
            <input
              type="password"
              className="input"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Repetir contraseña"
            />
          </div>
        </div>

        <div className="px-3 py-2.5 rounded-xl bg-pizarra-700/30 border border-pizarra-700/40">
          <p className="text-xs text-pizarra-400 leading-relaxed">
            <strong className="text-pizarra-300">Nota:</strong> El nuevo usuario podrá iniciar
            sesión inmediatamente con su correo y contraseña. Asegúrate de compartir
            las credenciales de forma segura.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={handleClose} className="btn-secondary">
            {success ? 'Cerrar' : 'Cancelar'}
          </button>
          {!success && (
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear usuario'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
