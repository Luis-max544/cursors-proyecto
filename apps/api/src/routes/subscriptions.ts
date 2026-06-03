import { Router } from 'express'
import * as SubscriptionService from '../services/subscription'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/checkout', authMiddleware, async (req, res, next) => {
  try {
    const result = await SubscriptionService.createCheckoutSession(req.user!.id)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

router.post('/portal', authMiddleware, async (req, res, next) => {
  try {
    const result = await SubscriptionService.createPortalSession(req.user!.id)
    res.json({ data: result })
  } catch (err) {
    next(err)
  }
})

// Raw body is mounted in index.ts before express.json() for this path
router.post('/webhook', async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'] as string
    await SubscriptionService.handleWebhookEvent(req.body as Buffer, sig)
    res.json({ received: true })
  } catch (err) {
    next(err)
  }
})

export default router
