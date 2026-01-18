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
  timeout: 300000, // 5 minutes timeout for avatar creation and status checks (can take time)
})

// Request deduplication interceptor
api.interceptors.request.use(async (config) => {
  // Create a unique key for this request
  const requestKey = `${config.method?.toUpperCase()}-${config.url}-${JSON.stringify(config.data)}`
  
  // For POST requests to login endpoint, check if there's already a pending request
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

// Handle token refresh on 401 and manage pending requests
api.interceptors.response.use(
  (response) => {
    // Clear pending request on success
    const requestKey = `${response.config.method?.toUpperCase()}-${response.config.url}-${JSON.stringify(response.config.data)}`
    pendingRequests.delete(requestKey)
    return response
  },
  async (error) => {
    // Clear pending request on error
    if (error.config) {
      const requestKey = `${error.config.method?.toUpperCase()}-${error.config.url}-${JSON.stringify(error.config.data)}`
      pendingRequests.delete(requestKey)
    }
    
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

