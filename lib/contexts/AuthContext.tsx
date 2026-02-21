'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  name: string
  role: 'CUSTOMER' | 'PARTNER' | 'ADMIN'
  phone?: string
  createdAt: string
  updatedAt: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (data: RegisterData) => Promise<void>
  refreshUser: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  name: string
  phone?: string
  role?: 'CUSTOMER' | 'PARTNER'
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // 자동 로그인 - 페이지 로드 시 토큰 확인
  useEffect(() => {
    const initAuth = () => {
      try {
        const savedToken = localStorage.getItem('token')
        const savedUser = localStorage.getItem('user')

        if (savedToken && savedUser) {
          // localStorage에서 복원
          setUser(JSON.parse(savedUser))
          setToken(savedToken)
        }
      } catch (error) {
        console.error('Auto-login failed:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // 로그인
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '로그인에 실패했습니다')
      }

      // 로그인 성공
      const userData = data.data?.user || data.user
      const tokenData = data.data?.token || data.token
      
      setUser(userData)
      setToken(tokenData)
      localStorage.setItem('token', tokenData)
      localStorage.setItem('user', JSON.stringify(userData))

      // 역할에 따라 리다이렉션
      if (userData.role === 'ADMIN') {
        router.push('/admin/dashboard')
      } else if (userData.role === 'PARTNER') {
        router.push('/partner/dashboard')
      } else {
        router.push('/shop')
      }
    } catch (error) {
      throw error
    }
  }

  // 회원가입 (자동 로그인 포함)
  const register = async (data: RegisterData) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || '회원가입에 실패했습니다')
      }

      // 회원가입 성공 시 자동 로그인
      const userData = result.data?.user || result.user
      const tokenData = result.data?.token || result.token
      
      setUser(userData)
      setToken(tokenData)
      localStorage.setItem('token', tokenData)
      localStorage.setItem('user', JSON.stringify(userData))

      // 역할에 따라 리다이렉션
      if (userData.role === 'PARTNER') {
        router.push('/partner/dashboard')
      } else {
        router.push('/shop')
      }
    } catch (error) {
      throw error
    }
  }

  // 로그아웃
  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  // 사용자 정보 새로고침 (localStorage에서 다시 로드)
  const refreshUser = async () => {
    if (!token) return

    try {
      // localStorage에서 다시 로드
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        register,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
