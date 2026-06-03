import { Router } from 'express'
import * as UsersService from '../services/users'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await UsersService.getMe(req.user!.id)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

export default router
