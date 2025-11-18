import axios from 'axios'
import { getToken, setToken, getRefreshToken, clearTokens } from '../utils/auth'

// Get API URL from build-time env var, runtime config, or default to /api
const getApiUrl = () => {
  // First try build-time environment variable
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== '__VITE_API_URL__') {
    return import.meta.env.VITE_API_URL
  }
  // Then try runtime config
  if (window.APP_CONFIG?.API_URL && window.APP_CONFIG.API_URL !== '__VITE_API_URL__') {
    return window.APP_CONFIG.API_URL
  }
  // Default to /api for development proxy
  return '/api'
}

const API_BASE_URL = getApiUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = getRefreshToken()
        const formData = new FormData()
        formData.append('refresh_token', refreshToken)
        
        const response = await axios.post(`${API_BASE_URL}/refresh`, formData)
        const { access_token } = response.data
        
        setToken(access_token)
        originalRequest.headers.Authorization = `Bearer ${access_token}`
        
        return api(originalRequest)
      } catch (refreshError) {
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export const register = async (username, email, password) => {
  const response = await axios.post(`${API_BASE_URL}/register`, {
    username,
    email: email || null,
    password
  })
  return response.data
}

export const login = async (username, password) => {
  const formData = new FormData()
  formData.append('username', username)
  formData.append('password', password)
  
  const response = await axios.post(`${API_BASE_URL}/token`, formData)
  return response.data
}

export const getCurrentUser = async () => {
  const response = await api.get('/me')
  return response.data
}

export const transcribeAudio = async (file, quality = 'high', onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('quality', quality)
  
  const response = await api.post('/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(progress)
      }
    }
  })
  
  return response.data
}

export const getTranscript = async (transcriptId, format = 'txt') => {
  const response = await api.get(`/transcripts/${transcriptId}`, {
    params: { format }
  })
  return response.data
}

export const checkHealth = async () => {
  const response = await axios.get(`${API_BASE_URL}/health`)
  return response.data
}

export default api
