import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'
import { ImagePracticePage } from './pages/ImagePracticePage'
import { PracticePage } from './pages/PracticePage'
import { TeacherPage } from './pages/TeacherPage'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'practice',
        element: <PracticePage />,
      },
      {
        path: 'practice/image',
        element: <ImagePracticePage />,
      },
      {
        path: 'teacher',
        element: <TeacherPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App