import Stripe from 'stripe'
import {env} from '../env'

const stripeNotConfiguredMessage = 'Stripe checkout is not configured.'

export function stripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(stripeNotConfiguredMessage)
  }

  return new Stripe(env.STRIPE_SECRET_KEY)
}

export function stripePriceId() {
  if (!env.STRIPE_PRICE_ID) {
    throw new Error(stripeNotConfiguredMessage)
  }

  return env.STRIPE_PRICE_ID
}
