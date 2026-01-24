import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 45000,
})

// Ensures Authorization header is always added if token exists
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Common response handling
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // If we get a 401, we don't automatically log out anymore to prevent loops,
      // but we should probably inform the user or handle it gracefully in components.
      console.warn(`[API] 401 Unauthorized on ${err.config?.url}`)
    }
    return Promise.reject(err)
  }
)

export default api
