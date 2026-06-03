import { Router } from 'express'
import { z } from 'zod'
import * as AuthService from '../services/auth'
import { rateLimiter } from '../middleware/rateLimiter'
import { authMiddleware } from '../middleware/auth'

const router = Router()
const authRateLimiter = rateLimiter({ max: 5, windowSecs: 60, keyPrefix: 'auth' })

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(60).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, and underscores only'),
  password: z.string().min(8),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const RefreshSchema = z.object({
  refreshToken: z.string(),
})

router.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const dto = RegisterSchema.parse(req.body)
    const result = await AuthService.register(dto)
    res.status(201).json({ data: result })
  } catch (err) {
    next(err)
  }
})

router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const dto = LoginSchema.parse(req.body)
    const result = await AuthService.login(dto)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

router.post('/refresh', authRateLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body)
    const result = await AuthService.refresh(refreshToken)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body)
    await AuthService.logout(refreshToken)
    res.json({ data: { message: 'Logged out successfully' } })
  } catch (err) {
    next(err)
  }
})

export default router
