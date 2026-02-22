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

  // 자동 로그인 - 페이지 로드 시 쿠키에서 사용자 정보 가져오기
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 쿠키에서 사용자 정보 가져오기 (서버 검증)
        const res = await fetch('/api/auth/me', {
          credentials: 'include', // 쿠키 포함
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data.user) {
            setUser(data.data.user);
            // localStorage에도 저장 (빠른 접근용)
            localStorage.setItem('user', JSON.stringify(data.data.user));
          }
        } else {
          // 쿠키가 없거나 유효하지 않음
          setUser(null);
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Auto-login failed:', error);
        setUser(null);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 로그인
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // 쿠키 포함
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '로그인에 실패했습니다')
      }

      // 로그인 성공 - 쿠키에 자동 저장됨
      const userData = data.data?.user || data.user
      const tokenData = data.data?.token || data.token
      
      setUser(userData)
      setToken(tokenData)
      // localStorage에도 저장 (빠른 접근용)
      localStorage.setItem('user', JSON.stringify(userData))

      // 역할에 따라 리다이렉션
      if (userData.role === 'ADMIN') {
        router.push('/admin/dashboard')
      } else if (userData.role === 'PARTNER') {
        router.push('/partner/dashboard')
      } else {
        router.push('/products')
      }
      
      // 페이지 새로고침하여 네비게이션 업데이트
      router.refresh()
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
        body: JSON.stringify(data),
        credentials: 'include', // 쿠키 포함
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || '회원가입에 실패했습니다')
      }

      // 회원가입 성공 시 자동 로그인 - 쿠키에 자동 저장됨
      const userData = result.data?.user || result.user
      const tokenData = result.data?.token || result.token
      
      setUser(userData)
      setToken(tokenData)
      // localStorage에도 저장 (빠른 접근용)
      localStorage.setItem('user', JSON.stringify(userData))

      // 역할에 따라 리다이렉션
      if (userData.role === 'PARTNER') {
        router.push('/partner/dashboard')
      } else {
        router.push('/products')
      }
      
      // 페이지 새로고침하여 네비게이션 업데이트
      router.refresh()
    } catch (error) {
      throw error
    }
  }

  // 로그아웃
  const logout = async () => {
    try {
      // 서버에 로그아웃 요청 (쿠키 삭제)
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setUser(null)
    setToken(null)
    localStorage.removeItem('user')
    router.push('/')
    router.refresh()
  }

  // 사용자 정보 새로고침 (서버에서 다시 가져오기)
  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data.user) {
          setUser(data.data.user);
          localStorage.setItem('user', JSON.stringify(data.data.user));
        }
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
