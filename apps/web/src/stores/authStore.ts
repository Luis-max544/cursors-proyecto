import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserDto } from '@nutrilearn/types'

interface AuthState {
  user: UserDto | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: UserDto, accessToken: string, refreshToken: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'nutrilearn-auth' },
  ),
)
