import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/Button'
import { LogOut, Video, User } from 'lucide-react'

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Video className="w-6 h-6 text-purple-600" />
            <span className="text-xl font-bold text-primary">Video Platform</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-sm font-medium text-gray-700 hover:text-purple-600 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/videos"
              className="text-sm font-medium text-gray-700 hover:text-purple-600 transition-colors"
            >
              Videos
            </Link>
            <Link
              to="/generate"
              className="text-sm font-medium text-gray-700 hover:text-purple-600 transition-colors"
            >
              Generate
            </Link>
            <Link
              to="/social"
              className="text-sm font-medium text-gray-700 hover:text-purple-600 transition-colors"
            >
              Social Accounts
            </Link>
            <Link
              to="/posts"
              className="text-sm font-medium text-gray-700 hover:text-purple-600 transition-colors"
            >
              Scheduled Posts
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{user?.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

