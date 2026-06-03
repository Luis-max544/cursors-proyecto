import express from 'express'
import cors from 'cors'
import { env } from '@nutrilearn/config'
import { errorHandler } from './middleware/error'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import videosRouter from './routes/videos'
import subscriptionsRouter from './routes/subscriptions'

const app = express()

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
// Stripe webhook needs the raw body — mount before express.json()
app.use('/v1/subscriptions/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/v1/auth', authRouter)
app.use('/v1/users', usersRouter)
app.use('/v1/videos', videosRouter)
app.use('/v1/subscriptions', subscriptionsRouter)

app.use(errorHandler)

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`)
})

export default app
