import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Token refresh logic — queue concurrent requests while a refresh is in flight
let isRefreshing = false
let refreshQueue: ((token: string) => void)[] = []

function drainQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token))
  refreshQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    const { refreshToken, clearAuth, setTokens } = useAuthStore.getState()
    if (!refreshToken) {
      clearAuth()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(api(originalRequest))
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post<{
        data: { accessToken: string; refreshToken: string }
      }>(`${import.meta.env.VITE_API_URL as string}/auth/refresh`, { refreshToken })

      const { accessToken, refreshToken: newRefreshToken } = data.data
      setTokens(accessToken, newRefreshToken)
      drainQueue(accessToken)
      originalRequest.headers.Authorization = `Bearer ${accessToken}`
      return api(originalRequest)
    } catch {
      clearAuth()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)
