import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

export function AuthHashHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    if (hash.includes('error_description=verification+email+link+is+invalid')) {
      console.warn('[Auth] Ignoring Supabase verification hash with expired token.')
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      return
    }

    if (hash.includes('access_token')) {
      const cleanedHash = hash.substring(1)
      const params = new URLSearchParams(cleanedHash)
      const type = params.get('type')

      if (type === 'signup' || type === 'recovery' || type === 'invite') {
        navigate(`/verify-email?${cleanedHash}`)
      } else {
        supabase.auth.setSession({
          access_token: params.get('access_token') ?? '',
          refresh_token: params.get('refresh_token') ?? '',
        }).catch((err) => {
          console.warn('[Auth] Unable to set session from OAuth hash.', err)
        })
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      }
    }
  }, [navigate])

  return null
}
