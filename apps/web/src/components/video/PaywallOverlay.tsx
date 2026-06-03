import { useNavigate } from 'react-router-dom'
import type { AccessError } from '@nutrilearn/types'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../ui/Button'
import { useState } from 'react'

interface PaywallOverlayProps {
  reason: AccessError | 'UNAUTHENTICATED'
  thumbnailUrl?: string | null
  freeViewsRemaining?: number
}

export function PaywallOverlay({ reason, thumbnailUrl, freeViewsRemaining }: PaywallOverlayProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/auth/login')
      return
    }
    setIsLoading(true)
    try {
      const { data } = await api.post<{ data: { checkoutUrl: string } }>('/subscriptions/checkout')
      window.location.href = data.data.checkoutUrl
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-lg">
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover blur-sm scale-105"
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/65 p-6 text-center text-white">
        <span className="text-5xl">🔒</span>

        {reason === 'SUBSCRIPTION_REQUIRED' && (
          <>
            <h3 className="text-xl font-semibold">Este video es exclusivo para miembros de NutriLearn</h3>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>✓ Acceso ilimitado a todo el contenido</li>
              <li>✓ Apoya a tus creadores favoritos</li>
              <li>✓ Sin anuncios</li>
            </ul>
          </>
        )}

        {reason === 'FREE_LIMIT_REACHED' && (
          <>
            <h3 className="text-xl font-semibold">Has usado tus 5 videos gratuitos este mes</h3>
            <p className="text-sm text-gray-300">Suscríbete para acceso ilimitado</p>
          </>
        )}

        {reason === 'UNAUTHENTICATED' && (
          <h3 className="text-xl font-semibold">Inicia sesión para ver este video</h3>
        )}

        <Button onClick={handleSubscribe} isLoading={isLoading} size="lg">
          {reason === 'UNAUTHENTICATED' ? 'Iniciar sesión' : 'Suscribirme'}
        </Button>

        {freeViewsRemaining !== undefined && freeViewsRemaining > 0 && (
          <p className="text-xs text-gray-400">
            Te quedan {freeViewsRemaining} videos gratuitos este mes
          </p>
        )}
      </div>
    </div>
  )
}
