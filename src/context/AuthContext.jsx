import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const perfilCacheRef = useRef({})

  // ─── 1. Listener de auth (liviano, SIN await) ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // ⚠️ NUNCA hacer await aquí — causa deadlock con el refresh de tokens
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ─── 2. Cargar perfil APARTE, reactivo al user ───
  useEffect(() => {
    if (!user) {
      setPerfil(null)
      setLoading(false)
      return
    }

    if (perfilCacheRef.current[user.id]) {
      setPerfil(perfilCacheRef.current[user.id])
      setLoading(false)
      return
    }

    let cancelado = false

    async function fetchPerfil() {
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error
        if (!cancelado) {
          perfilCacheRef.current[user.id] = data
          setPerfil(data)
        }
      } catch (err) {
        console.error('Error al obtener perfil:', err)
        if (!cancelado) setPerfil(null)
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    fetchPerfil()
    return () => { cancelado = true }
  }, [user])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    perfilCacheRef.current = {}
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error al cerrar sesión:', error)
  }

  const value = {
    user,
    perfil,
    loading,
    signIn,
    signOut,
    isAdmin: perfil?.rol === 'administradora',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}