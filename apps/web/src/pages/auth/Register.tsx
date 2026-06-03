import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import type { AuthResponseDto } from '@nutrilearn/types'
import { useState } from 'react'

const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  username: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(60, 'Máximo 60 caracteres')
    .regex(/^[a-z0-9_]+$/, 'Solo letras minúsculas, números y guiones bajos'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})
type RegisterForm = z.infer<typeof RegisterSchema>

export default function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(RegisterSchema) })

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null)
    try {
      const { data } = await api.post<{ data: AuthResponseDto }>('/auth/register', values)
      setAuth(data.data.user, data.data.accessToken, data.data.refreshToken)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message
      setServerError(msg ?? 'Error al registrarse')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
          Crear cuenta en <span className="text-blue-600">NutriLearn</span>
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Nombre de usuario"
            type="text"
            autoComplete="username"
            placeholder="solo_letras_minusculas"
            error={errors.username?.message}
            {...register('username')}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>
          )}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Crear cuenta
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/auth/login" className="text-blue-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
