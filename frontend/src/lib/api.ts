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
      // Token is invalid - clear storage and redirect to login
      localStorage.removeItem('access_token')
      localStorage.removeItem('auth_user')
      console.warn('[API] 401 Unauthorized - clearing auth and redirecting to login')
      
      // Don't redirect if we're already on the login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }
    return Promise.reject(error)
  }
)

export default api

