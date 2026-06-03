import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMe } from '../../hooks/useMe'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { Navbar } from '../../components/layout/Navbar'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'

export default function Billing() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { data: me, isLoading } = useMe()
  const [isRedirecting, setIsRedirecting] = useState(false)

  if (!user) {
    navigate('/auth/login')
    return null
  }

  const handleSubscribe = async () => {
    setIsRedirecting(true)
    try {
      const { data } = await api.post<{ data: { checkoutUrl: string } }>('/subscriptions/checkout')
      window.location.href = data.data.checkoutUrl
    } finally {
      setIsRedirecting(false)
    }
  }

  const handleManage = async () => {
    setIsRedirecting(true)
    try {
      const { data } = await api.post<{ data: { portalUrl: string } }>('/subscriptions/portal')
      window.location.href = data.data.portalUrl
    } finally {
      setIsRedirecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">Suscripción</h1>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          ) : me?.subscription.active ? (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <p className="font-medium text-gray-900">Suscripción activa</p>
              </div>
              {me.subscription.currentPeriodEnd && (
                <p className="text-sm text-gray-500">
                  Próxima facturación:{' '}
                  {new Date(me.subscription.currentPeriodEnd).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
              <Button variant="secondary" onClick={handleManage} isLoading={isRedirecting}>
                Administrar suscripción
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="font-medium text-gray-900">Plan gratuito</p>
                <p className="text-sm text-gray-500 mt-1">
                  {me ? `${me.freeViewsUsed} de ${me.freeViewsLimit}` : '—'} videos gratuitos usados este mes
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4 space-y-3">
                <p className="font-semibold text-blue-900">Plan de membresía NutriLearn</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✓ Acceso ilimitado a todos los videos</li>
                  <li>✓ Contenido premium exclusivo</li>
                  <li>✓ Apoya a tus creadores favoritos</li>
                  <li>✓ Sin restricciones mensuales</li>
                </ul>
                <Button onClick={handleSubscribe} isLoading={isRedirecting}>
                  Suscribirme ahora
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
