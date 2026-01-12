import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { BillingGateProvider } from './contexts/BillingGateContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AuthHashHandler } from './components/auth/AuthHashHandler'
import { ToastContainer } from './components/ui/Toast'
import { useToast } from './hooks/useToast'

// Pages
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { VerifyEmail } from './pages/VerifyEmail'
import { Dashboard } from './pages/Dashboard'
import { Videos } from './pages/Videos'
import { GenerateVideo } from './pages/GenerateVideo'
import { QuickCreate } from './pages/QuickCreate'
import { SocialAccounts } from './pages/SocialAccounts'
import { ScheduledPosts } from './pages/ScheduledPosts'
import { SocialCallback } from './pages/SocialCallback'
import { ContentFactory } from './pages/ContentFactory'
import { Workflows } from './pages/Workflows'
import { AdminPanel } from './pages/AdminPanel'
import { VideoPlanning } from './pages/VideoPlanning'
import { ProfileSettings } from './pages/ProfileSettings'
import { Preferences } from './pages/Preferences'
import { Credits } from './pages/Credits'
import { Avatars } from './pages/Avatars'

function AppContent() {
  const { toasts, removeToast } = useToast()

  return (
    <>
      <AuthHashHandler />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/videos"
          element={
            <ProtectedRoute>
              <Videos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/generate"
          element={
            <ProtectedRoute>
              <GenerateVideo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <QuickCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quick-create"
          element={
            <ProtectedRoute>
              <Navigate to="/create" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/generate"
          element={
            <ProtectedRoute>
              <Navigate to="/create" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/social"
          element={
            <ProtectedRoute>
              <SocialAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts"
          element={
            <ProtectedRoute>
              <ScheduledPosts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planning"
          element={
            <ProtectedRoute>
              <VideoPlanning />
            </ProtectedRoute>
          }
        />
        <Route
          path="/content"
          element={
            <ProtectedRoute>
              <ContentFactory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflows"
          element={
            <ProtectedRoute>
              <Workflows />
            </ProtectedRoute>
          }
        />
        <Route
          path="/social/callback"
          element={
            <ProtectedRoute>
              <SocialCallback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/preferences"
          element={
            <ProtectedRoute>
              <Preferences />
            </ProtectedRoute>
          }
        />
        <Route
          path="/credits"
          element={
            <ProtectedRoute>
              <Credits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/avatars"
          element={
            <ProtectedRoute>
              <Avatars />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="*" element={<Navigate to="/create" replace />} />
      </Routes>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <BillingGateProvider>
            <AppContent />
          </BillingGateProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

