import axios from 'axios'
import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 300000, // 5 minutes timeout for avatar creation and status checks (can take time)
})

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle network errors
    if (error.code === 'ECONNABORTED' || error.message === 'Network Error' || !error.response) {
      console.error('Network error:', error.message)
      // Don't redirect on network errors during login - let the component handle it
      if (!error.config?.url?.includes('/api/auth/login')) {
        return Promise.reject(error)
      }
    }
    
    if (error.response?.status === 401) {
      // Try to refresh the Supabase session once, then retry the request.
      // This prevents "random logouts" when access tokens expire.
      const originalRequest = error.config
      if (!originalRequest?._retry) {
        originalRequest._retry = true
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const hasRefresh = !!sessionData.session?.refresh_token
          const { data: refreshed } = hasRefresh
            ? await supabase.auth.refreshSession()
            : await supabase.auth.refreshSession()

          const newToken = refreshed.session?.access_token
          if (newToken) {
            localStorage.setItem('access_token', newToken)
            originalRequest.headers = originalRequest.headers || {}
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return api.request(originalRequest)
          }
        } catch (refreshError) {
          // fall through to redirect below
          console.warn('[API] Token refresh failed:', refreshError)
        }
      }

      // Don't redirect if we're already on the login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

