import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>()

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 300000, // 5 minutes
})

// Request deduplication interceptor
api.interceptors.request.use(async (config) => {
  const requestKey = `${config.method?.toUpperCase()}-${config.url}-${JSON.stringify(config.data)}`

  if (config.method === 'post' && config.url?.includes('/api/auth/login')) {
    const existingRequest = pendingRequests.get(requestKey)
    if (existingRequest) {
      console.log('[API] Deduplicating duplicate login request')
      throw new axios.Cancel('Duplicate request cancelled')
    }
  }

  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const requestKey = `${response.config.method?.toUpperCase()}-${response.config.url}-${JSON.stringify(response.config.data)}`
    pendingRequests.delete(requestKey)
    return response
  },
  async (error) => {
    if (error.config) {
      const requestKey = `${error.config.method?.toUpperCase()}-${error.config.url}-${JSON.stringify(error.config.data)}`
      pendingRequests.delete(requestKey)
    }

    if (error.code === 'ECONNABORTED' || error.message === 'Network Error' || !error.response) {
      console.error('Network error:', error.message)
      return Promise.reject(error)
    }

    if (error.response?.status === 401) {
      const url = error.config?.url || 'unknown'
      console.warn(`[API TRACE] 401 Unauthorized on ${url}. NO AUTO-LOGOUT TRIGGERED.`)
      // I've removed the clear logout here to see if users stay logged in.
    }
    return Promise.reject(error)
  }
)

export default api
