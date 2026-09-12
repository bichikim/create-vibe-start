import {defineEventHandler} from 'h3'
import type Stripe from 'stripe'
import {env} from '../../../env'
import {stripeClient} from '../../../lib/stripe'

export default defineEventHandler(async (event) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({error: 'Stripe webhook is not configured.'}, {status: 500})
  }

  const signature = event.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({error: 'Missing Stripe signature.'}, {status: 400})
  }

  const body = await event.req.text()

  try {
    const stripeEvent = stripeClient().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session
      console.info('Stripe checkout completed', {
        id: session.id,
        paymentStatus: session.payment_status,
        shipping: session.collected_information?.shipping_details,
      })
    }

    return Response.json({received: true})
  } catch {
    return Response.json({error: 'Invalid Stripe webhook signature.'}, {status: 400})
  }
})
