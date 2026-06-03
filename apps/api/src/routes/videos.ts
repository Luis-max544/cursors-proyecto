import { Router } from 'express'
import { z } from 'zod'
import * as VideoService from '../services/video'
import { optionalAuth } from '../middleware/auth'

const router = Router()

const ListQuerySchema = z.object({
  category: z.enum(['programming', 'science', 'math', 'languages']).optional(),
  sort: z.enum(['recent', 'popular']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const query = ListQuerySchema.parse(req.query)
    const result = await VideoService.listVideos(query)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const ip = req.ip ?? req.socket.remoteAddress
    const result = await VideoService.getVideo(req.params.id, req.user?.id, ip)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/view', optionalAuth, async (req, res, next) => {
  try {
    const ip = req.ip ?? req.socket.remoteAddress
    const counted = await VideoService.recordView(req.params.id, req.user?.id, ip)
    res.json({ data: { counted } })
  } catch (err) {
    next(err)
  }
})

export default router
