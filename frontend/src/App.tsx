import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { BillingGateProvider } from './contexts/BillingGateContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AdminRoute } from './components/auth/AdminRoute'
import { AuthHashHandler } from './components/auth/AuthHashHandler'
import { LanguageProvider } from './contexts/LanguageContext'
import { ToastContainer } from './components/ui/Toast'
import { useToast } from './hooks/useToast'
import { supabaseConfigError } from './lib/supabase'

// Pages
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { VerifyEmail } from './pages/VerifyEmail'
import { Dashboard } from './pages/Dashboard'
import { Analysts } from './pages/Analysts'
import { TrendSearcher } from './pages/TrendSearcher'
import { Videos } from './pages/Videos'
import { GenerateVideo } from './pages/GenerateVideo'
import { QuickCreate } from './pages/QuickCreate'
import { SocialAccounts } from './pages/SocialAccounts'
import { ScheduledPosts } from './pages/ScheduledPosts'
import { SocialCallback } from './pages/SocialCallback'
import { Workflows } from './pages/Workflows'
import { AdminPanel } from './pages/AdminPanel'
import { VideoPlanning } from './pages/VideoPlanning'
import { ProfileSettings } from './pages/ProfileSettings'
import { Preferences } from './pages/Preferences'
import { Credits } from './pages/Credits'
import { Avatars } from './pages/Avatars'
import { Support } from './pages/Support'
import { AdminSupport } from './pages/AdminSupport'
import { PublicOffer } from './pages/PublicOffer'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { CookieConsentManager } from './components/legal/CookieConsentManager'
import { TermsOfService } from './pages/TermsOfService'
import { CookiePolicy } from './pages/CookiePolicy'
import { AcceptableUsePolicy } from './pages/AcceptableUsePolicy'
import { Dpa } from './pages/Dpa'

const isWorkflowRouteEnabled = import.meta.env.DEV

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
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analysts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trend-searcher"
          element={
            <ProtectedRoute>
              <TrendSearcher />
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
          path="/social/dms"
          element={
            <ProtectedRoute>
              <Navigate to="/social" replace />
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
              <Navigate to="/planning" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflows"
          element={
            isWorkflowRouteEnabled ? (
              <ProtectedRoute>
                <Workflows />
              </ProtectedRoute>
            ) : (
              <AdminRoute>
                <Workflows />
              </AdminRoute>
            )
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
            <AdminRoute>
              <AdminPanel />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/support"
          element={
            <AdminRoute>
              <AdminSupport />
            </AdminRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <Support />
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
        <Route path="/public-offer" element={<PublicOffer />} />
        <Route path="/privacy-policy" element={<Navigate to="/legal/privacy" replace />} />
        <Route path="/legal/privacy" element={<PrivacyPolicy />} />
        <Route path="/legal/terms" element={<TermsOfService />} />
        <Route path="/legal/cookies" element={<CookiePolicy />} />
        <Route path="/legal/acceptable-use" element={<AcceptableUsePolicy />} />
        <Route path="/legal/dpa" element={<Dpa />} />

        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="*" element={<Navigate to="/create" replace />} />
      </Routes>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <CookieConsentManager />
    </>
  )
}

import { ErrorBoundary } from './components/ui/ErrorBoundary'

// ... imports

import { CreditProvider } from './contexts/CreditContext'

function App() {
  if (supabaseConfigError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <span className="text-3xl">⚙️</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Supabase configuration required</h1>
          <p className="text-sm text-slate-500">
            The app is missing the Supabase environment variables needed to start. Please set
            <span className="font-semibold text-slate-700"> VITE_SUPABASE_URL</span> and
            <span className="font-semibold text-slate-700"> VITE_SUPABASE_ANON_KEY</span> and reload.
          </p>
          <div className="rounded-lg bg-slate-100 p-3 text-left">
            <p className="font-mono text-xs text-amber-700">{supabaseConfigError}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <CreditProvider>
              <NotificationProvider>
                <BillingGateProvider>
                  <AppContent />
                </BillingGateProvider>
              </NotificationProvider>
            </CreditProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
