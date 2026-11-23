import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SkeletonAppShellWithAuth } from './Skeleton'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <SkeletonAppShellWithAuth />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const isPasswordSetupPage = location.pathname === "/set-password"
  if (user.password_setup_required && !isPasswordSetupPage) {
    return <Navigate to="/set-password" replace />
  }
  if (!user.password_setup_required && isPasswordSetupPage) {
    return <Navigate to="/" replace />
  }

  return children
}
