import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const pendingRequests = new Map<string, Promise<any>>()

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 300000,
})

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || 'unknown'
      const projectId = err.response.data?.projectId

      console.warn(`[API TRACE] 401 on ${url}. Backend Project: ${projectId}`)

      // Dispatch custom event for Layout.tsx to pick up
      window.dispatchEvent(new CustomEvent('api-401-detail', {
        detail: { projectId, url }
      }))
    }
    return Promise.reject(err)
  }
)

export default api
