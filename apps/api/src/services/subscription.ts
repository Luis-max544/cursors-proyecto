import Stripe from 'stripe'
import { db, users, platformSubscriptions } from '@nutrilearn/db'
import { eq } from 'drizzle-orm'
import { env } from '@nutrilearn/config'
import { AppError } from '../middleware/error'
import { redis } from '../lib/redis'

const stripe = new Stripe(env.STRIPE_SECRET_KEY)

type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

function toSubStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
    incomplete: 'past_due',
    incomplete_expired: 'canceled',
    unpaid: 'past_due',
    paused: 'past_due',
  }
  return map[s] ?? 'past_due'
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutSession(userId: string): Promise<{ checkoutUrl: string }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found')

  let stripeCustomerId = user.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ email: user.email })
    stripeCustomerId = customer.id
    await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId))
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${env.CORS_ORIGIN}/settings/billing?success=1`,
    cancel_url: `${env.CORS_ORIGIN}/settings/billing?canceled=1`,
  })

  return { checkoutUrl: session.url! }
}

// ─── Billing portal ───────────────────────────────────────────────────────────

export async function createPortalSession(userId: string): Promise<{ portalUrl: string }> {
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user?.stripeCustomerId) {
    throw new AppError(400, 'NO_SUBSCRIPTION', 'No Stripe customer record found')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.CORS_ORIGIN}/settings/billing`,
  })

  return { portalUrl: session.url }
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export async function handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Webhook signature verification failed')
  }

  // Idempotency: only process each event once (24h window)
  const processed = await redis.set(`stripe:event:${event.id}`, '1', 'EX', 86400, 'NX')
  if (!processed) return

  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    case 'invoice.payment_succeeded':
      await onInvoiceSucceeded(event.data.object as Stripe.Invoice)
      break
    case 'invoice.payment_failed':
      await onInvoiceFailed(event.data.object as Stripe.Invoice)
      break
    case 'customer.subscription.deleted':
      await onSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || !session.subscription) return

  const stripeSubId = session.subscription as string
  const stripeCustomerId = session.customer as string

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId))
    .limit(1)

  if (!user) return

  const sub = await stripe.subscriptions.retrieve(stripeSubId)

  await db
    .insert(platformSubscriptions)
    .values({
      userId: user.id,
      stripeSubscriptionId: stripeSubId,
      stripePriceId: sub.items.data[0].price.id,
      status: toSubStatus(sub.status),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: platformSubscriptions.stripeSubscriptionId,
      set: {
        status: toSubStatus(sub.status),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        updatedAt: new Date(),
      },
    })
}

async function onInvoiceSucceeded(invoice: Stripe.Invoice) {
  const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!stripeSubId) return

  const sub = await stripe.subscriptions.retrieve(stripeSubId)

  await db
    .update(platformSubscriptions)
    .set({
      status: 'active',
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(platformSubscriptions.stripeSubscriptionId, stripeSubId))
}

async function onInvoiceFailed(invoice: Stripe.Invoice) {
  const stripeSubId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
  if (!stripeSubId) return

  await db
    .update(platformSubscriptions)
    .set({ status: 'past_due', updatedAt: new Date() })
    .where(eq(platformSubscriptions.stripeSubscriptionId, stripeSubId))
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  await db
    .update(platformSubscriptions)
    .set({ status: 'canceled', updatedAt: new Date() })
    .where(eq(platformSubscriptions.stripeSubscriptionId, sub.id))
}
