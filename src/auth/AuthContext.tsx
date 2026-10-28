import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi, setOnSessionExpired } from '../api/client'
import { getMe } from '../api/endpoints'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)

  const clearSession = useCallback(() => {
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => setOnSessionExpired(clearSession), [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    // Token stays only in memory.
    const { device_session_token } = await authApi.login(email, password)
    await authApi.issue(device_session_token)
    setUser(await getMe())
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.revoke()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
