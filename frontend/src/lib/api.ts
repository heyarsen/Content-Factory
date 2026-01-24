import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 300000,
})

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('access_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    console.warn(`[API DEBUG] No token found in localStorage for ${config.url}`)
  }

  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || 'unknown'
      const projectId = err.response.data?.projectId
      const errorMsg = err.response.data?.error

      console.error(`[API 401 ERROR] ${url} | Server message: ${errorMsg} | Backend Project: ${projectId}`)

      // Dispatch custom event for Layout.tsx to pick up
      window.dispatchEvent(new CustomEvent('api-401-detail', {
        detail: { projectId, url, errorMsg }
      }))
    }
    return Promise.reject(err)
  }
)

export default api
