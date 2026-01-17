import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface AdminRouteProps {
  children: ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading } = useAuth()

  console.log('[AdminRoute] Check:', { user: user?.email, role: user?.role, loading })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!user) {
    console.log('[AdminRoute] No user found, redirecting to login')
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'admin') {
    console.log('[AdminRoute] User is not admin (role:', user.role, '), redirecting to dashboard')
    return <Navigate to="/dashboard" replace />
  }

  console.log('[AdminRoute] User is admin, allowing access')
  return <>{children}</>
}
