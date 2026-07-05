<script setup lang="ts">
import {useMutation} from '@pinia/colada'
import AppButton from '../components/ui/AppButton.vue'
import {authClient} from '../lib/auth-client'
import {orpc} from '../orpc'

const session = authClient.useSession()

const checkout = useMutation({
  mutation: () => orpc.billing.createCheckoutSession(),
  onSuccess(result) {
    window.location.href = result.url
  },
})

function buyStickerPack() {
  checkout.mutate()
}
</script>

<template>
  <section class="grid gap-6">
    <div>
      <h2 class="text-2xl font-semibold">Vibe Start Sticker Pack</h2>
      <p class="mt-1 text-sm text-slate-500">
        A one-time merch purchase powered by Stripe Checkout. The final price comes from your Stripe Price.
      </p>
    </div>

    <div class="grid gap-5 rounded-lg border border-slate-200 bg-white p-5">
      <div class="grid gap-2">
        <p class="text-sm font-medium text-slate-500">Physical goods demo</p>
        <h3 class="text-xl font-semibold">Sticker pack</h3>
        <p class="text-slate-600">
          Checkout collects the delivery address in Stripe. This example ships to Korea and includes delivery in the
          product price.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <AppButton
          type="button"
          :disabled="!session.data?.user || checkout.asyncStatus.value === 'loading'"
          @click="buyStickerPack"
        >
          Buy with Stripe
        </AppButton>
        <RouterLink v-if="!session.data?.user" class="text-sm text-slate-600 underline" to="/login">
          Sign in to buy
        </RouterLink>
      </div>

      <p v-if="checkout.error.value" class="text-sm text-red-700">
        Checkout is not available. Confirm your Stripe environment variables.
      </p>
    </div>
  </section>
</template>
