import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AuthPage } from './features/auth/AuthPage'
import { AuthProvider } from './features/auth/AuthProvider'
import { RequireAuth } from './features/auth/RequireAuth'
import { DashboardPage } from './pages/DashboardPage'
import { ImagePracticePage } from './pages/ImagePracticePage'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PracticePage } from './pages/PracticePage'
import { ProgressPage } from './pages/ProgressPage'
import { TeacherPage } from './pages/TeacherPage'

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/signup', element: <AuthPage mode="signup" /> },
  {
    path: '/app',
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'practice', element: <PracticePage /> },
          { path: 'practice/image', element: <ImagePracticePage /> },
          { path: 'references', element: <TeacherPage /> },
          { path: 'progress', element: <ProgressPage /> },
        ],
      },
    ],
  },
  // Stare adresy sprzed podziału na stronę publiczną i aplikację.
  { path: '/practice', element: <Navigate to="/app/practice" replace /> },
  { path: '/practice/image', element: <Navigate to="/app/practice/image" replace /> },
  { path: '/teacher', element: <Navigate to="/app/references" replace /> },
  { path: '*', element: <NotFoundPage /> },
])

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
