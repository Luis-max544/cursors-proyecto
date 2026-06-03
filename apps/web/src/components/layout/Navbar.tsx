import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../ui/Button'

const CATEGORIES = [
  { label: 'Programación', value: 'programming' },
  { label: 'Ciencia', value: 'science' },
  { label: 'Matemáticas', value: 'math' },
  { label: 'Idiomas', value: 'languages' },
]

export function Navbar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link to="/" className="text-xl font-bold text-blue-600">
          NutriLearn
        </Link>

        <nav className="hidden gap-4 md:flex">
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
            Inicio
          </Link>
          <Link to="/discover" className="text-sm text-gray-600 hover:text-gray-900">
            Explorar
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm text-gray-600 hidden sm:block">{user.username}</span>
              <Link to="/settings/billing">
                <Button variant="ghost" size="sm">Suscripción</Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Salir
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth/login">
                <Button variant="ghost" size="sm">Iniciar sesión</Button>
              </Link>
              <Link to="/auth/register">
                <Button size="sm">Registrarse</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 px-4">
        <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto py-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.value}
              to={`/discover?category=${cat.value}`}
              className="shrink-0 text-sm text-gray-500 hover:text-gray-900"
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  )
}
