import axios from 'axios'

const getDefaultApiUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001'
  }

  const { origin, protocol, hostname } = window.location
  const envPort = import.meta.env.VITE_API_PORT

  if (envPort) {
    return `${protocol}//${hostname}:${envPort}`
  }

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  return isLocalhost ? `${protocol}//${hostname}:3001` : origin
}

const API_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl()

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
