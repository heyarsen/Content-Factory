import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { BillingGateProvider } from './contexts/BillingGateContext'
import { CreditProvider } from './contexts/CreditContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AdminRoute } from './components/auth/AdminRoute'
import { AuthHashHandler } from './components/auth/AuthHashHandler'
import { LanguageProvider } from './contexts/LanguageContext'
import { ToastContainer } from './components/ui/Toast'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { useToast } from './hooks/useToast'
import { supabaseConfigError } from './lib/supabase'

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('./pages/Signup').then((m) => ({ default: m.Signup })))
const ForgotPassword = lazy(() =>
  import('./pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword }))
)
const ResetPassword = lazy(() =>
  import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword }))
)
const VerifyEmail = lazy(() =>
  import('./pages/VerifyEmail').then((m) => ({ default: m.VerifyEmail }))
)
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Analysts = lazy(() => import('./pages/Analysts').then((m) => ({ default: m.Analysts })))
const TrendSearcher = lazy(() =>
  import('./pages/TrendSearcher').then((m) => ({ default: m.TrendSearcher }))
)
const Videos = lazy(() => import('./pages/Videos').then((m) => ({ default: m.Videos })))
const GenerateVideo = lazy(() =>
  import('./pages/GenerateVideo').then((m) => ({ default: m.GenerateVideo }))
)
const QuickCreate = lazy(() => import('./pages/QuickCreate').then((m) => ({ default: m.QuickCreate })))
const SocialAccounts = lazy(() =>
  import('./pages/SocialAccounts').then((m) => ({ default: m.SocialAccounts }))
)
const InstagramDMs = lazy(() =>
  import('./pages/InstagramDMs').then((m) => ({ default: m.InstagramDMs }))
)
const ScheduledPosts = lazy(() =>
  import('./pages/ScheduledPosts').then((m) => ({ default: m.ScheduledPosts }))
)
const SocialCallback = lazy(() =>
  import('./pages/SocialCallback').then((m) => ({ default: m.SocialCallback }))
)
const Workflows = lazy(() => import('./pages/Workflows').then((m) => ({ default: m.Workflows })))
const AdminPanel = lazy(() => import('./pages/AdminPanel').then((m) => ({ default: m.AdminPanel })))
const VideoPlanning = lazy(() =>
  import('./pages/VideoPlanning').then((m) => ({ default: m.VideoPlanning }))
)
const ProfileSettings = lazy(() =>
  import('./pages/ProfileSettings').then((m) => ({ default: m.ProfileSettings }))
)
const Preferences = lazy(() => import('./pages/Preferences').then((m) => ({ default: m.Preferences })))
const Credits = lazy(() => import('./pages/Credits').then((m) => ({ default: m.Credits })))
const Avatars = lazy(() => import('./pages/Avatars').then((m) => ({ default: m.Avatars })))
const Support = lazy(() => import('./pages/Support').then((m) => ({ default: m.Support })))
const AdminSupport = lazy(() =>
  import('./pages/AdminSupport').then((m) => ({ default: m.AdminSupport }))
)
const PublicOffer = lazy(() =>
  import('./pages/PublicOffer').then((m) => ({ default: m.PublicOffer }))
)
const PrivacyPolicy = lazy(() =>
  import('./pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy }))
)
const TermsOfService = lazy(() =>
  import('./pages/TermsOfService').then((m) => ({ default: m.TermsOfService }))
)
const CookiePolicy = lazy(() =>
  import('./pages/CookiePolicy').then((m) => ({ default: m.CookiePolicy }))
)
const AcceptableUsePolicy = lazy(() =>
  import('./pages/AcceptableUsePolicy').then((m) => ({ default: m.AcceptableUsePolicy }))
)
const Dpa = lazy(() => import('./pages/Dpa').then((m) => ({ default: m.Dpa })))
const CookieConsentManager = lazy(() =>
  import('./components/legal/CookieConsentManager').then((m) => ({ default: m.CookieConsentManager }))
)

const isWorkflowRouteEnabled = import.meta.env.DEV

function RouteSkeleton() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
    </div>
  )
}

function AppContent() {
  const { toasts, removeToast } = useToast()

  return (
    <>
      <AuthHashHandler />
      <Suspense fallback={<RouteSkeleton />}>
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
                <InstagramDMs />
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
      </Suspense>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <Suspense fallback={null}>
        <CookieConsentManager />
      </Suspense>
    </>
  )
}

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
