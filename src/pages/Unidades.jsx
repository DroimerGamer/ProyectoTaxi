import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/Modal'
import { Car, Plus, Pencil, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_FORM = { numero: '', placas: '', chofer: '', permiso: '', activa: true }

export default function Unidades() {
  const { data: unidades, loading, refetch } = useSupabaseQuery('unidades', {
    orderBy: 'numero',
    ascending: true,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  function openNew() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(unidad) {
    setForm({
      numero: unidad.numero,
      placas: unidad.placas,
      chofer: unidad.chofer,
      permiso: unidad.permiso || '',
      activa: unidad.activa,
    })
    setEditId(unidad.id)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.numero || !form.placas || !form.chofer) {
      toast.error('Complete los campos obligatorios')
      return
    }

    setSaving(true)
    try {
      if (editId) {
        const { error } = await supabase
          .from('unidades')
          .update(form)
          .eq('id', editId)
        if (error) throw error
        toast.success('Unidad actualizada')
      } else {
        const { error } = await supabase
          .from('unidades')
          .insert(form)
        if (error) throw error
        toast.success('Unidad registrada')
      }
      setModalOpen(false)
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActiva(unidad) {
    try {
      const { error } = await supabase
        .from('unidades')
        .update({ activa: !unidad.activa })
        .eq('id', unidad.id)
      if (error) throw error
      toast.success(unidad.activa ? 'Unidad desactivada' : 'Unidad activada')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-taxi-500" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Unidades" subtitle={`${unidades.length} unidades registradas`}>
        <button onClick={openNew} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nueva unidad
        </button>
      </PageHeader>

      {unidades.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Sin unidades"
          message="Registra tu primer taxi para comenzar."
        >
          <button onClick={openNew} className="btn-primary">
            <Plus className="w-4 h-4" />
            Registrar unidad
          </button>
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pizarra-700/50">
                  <th className="table-header">Número</th>
                  <th className="table-header">Placas</th>
                  <th className="table-header">Chofer</th>
                  <th className="table-header">Permiso</th>
                  <th className="table-header">Estado</th>
                  <th className="table-header text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pizarra-700/30">
                {unidades.map((u) => (
                  <tr key={u.id} className="hover:bg-pizarra-700/20 transition-colors">
                    <td className="table-cell font-mono font-semibold text-taxi-400">
                      #{u.numero}
                    </td>
                    <td className="table-cell font-mono">{u.placas}</td>
                    <td className="table-cell">{u.chofer}</td>
                    <td className="table-cell text-pizarra-400">{u.permiso || '—'}</td>
                    <td className="table-cell">
                      <button onClick={() => toggleActiva(u)}>
                        <span className={u.activa ? 'badge-activa' : 'badge-inactiva'}>
                          {u.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </button>
                    </td>
                    <td className="table-cell text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-2 rounded-lg hover:bg-pizarra-700/50 text-pizarra-400 hover:text-pizarra-200 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de formulario */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar unidad' : 'Nueva unidad'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Número *</label>
              <input
                className="input"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="Ej: 101"
              />
            </div>
            <div>
              <label className="label">Placas *</label>
              <input
                className="input"
                value={form.placas}
                onChange={(e) => setForm({ ...form, placas: e.target.value.toUpperCase() })}
                placeholder="Ej: ABC-1234"
              />
            </div>
          </div>

          <div>
            <label className="label">Chofer *</label>
            <input
              className="input"
              value={form.chofer}
              onChange={(e) => setForm({ ...form, chofer: e.target.value })}
              placeholder="Nombre del chofer"
            />
          </div>

          <div>
            <label className="label">Permiso</label>
            <input
              className="input"
              value={form.permiso}
              onChange={(e) => setForm({ ...form, permiso: e.target.value })}
              placeholder="Número de permiso (opcional)"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editId ? 'Guardar cambios' : 'Registrar')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
