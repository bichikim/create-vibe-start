<script setup lang="ts">
import {computed} from 'vue'
import {useRoute} from 'vue-router'

const route = useRoute()
const sessionId = computed(() => {
  if (typeof route.query.session_id === 'string') {
    return route.query.session_id
  }

  return ''
})
</script>

<template>
  <section class="grid gap-4">
    <div>
      <h2 class="text-2xl font-semibold">Purchase complete</h2>
      <p class="mt-1 text-sm text-slate-500">
        Stripe confirmed the checkout. Fulfillment should be handled from the verified webhook event.
      </p>
    </div>

    <p v-if="sessionId" class="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
      Checkout session: {{ sessionId }}
    </p>
  </section>
</template>
