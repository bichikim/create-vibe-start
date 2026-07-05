<script setup lang="ts">
import {TooltipProvider} from 'reka-ui'
import AppButton from './components/ui/AppButton.vue'
import {authClient} from './lib/auth-client'

const session = authClient.useSession()

async function signOut() {
  await authClient.signOut()
}
</script>

<template>
  <TooltipProvider>
    <main class="mx-auto max-w-3xl px-5 py-12 text-slate-900">
      <header class="mb-8 flex items-center justify-between gap-5 max-sm:flex-col max-sm:items-stretch">
        <div>
          <p class="mb-1.5 text-sm text-slate-500">Nitro + Vue + oRPC + Drizzle + Better Auth</p>
          <h1 class="text-4xl leading-none font-semibold">Vibe Start</h1>
        </div>

        <div class="flex flex-col items-end gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <p v-if="session.data?.user" class="text-sm text-slate-600">
              {{ session.data.user.email }}
            </p>
            <AppButton v-if="session.data?.user" type="button" variant="secondary" @click="signOut">
              Sign out
            </AppButton>
            <RouterLink
              v-else
              class="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600"
              to="/login"
            >
              Sign in
            </RouterLink>
          </div>

          <nav class="flex flex-wrap gap-2">
            <RouterLink
              class="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 aria-[current=page]:border-slate-900 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white"
              to="/"
            >
              Notes
            </RouterLink>
            <RouterLink
              class="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 aria-[current=page]:border-slate-900 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white"
              to="/about"
            >
              About
            </RouterLink>
            <RouterLink
              class="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 aria-[current=page]:border-slate-900 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white"
              to="/billing"
            >
              Billing
            </RouterLink>
          </nav>
        </div>
      </header>

      <RouterView />
    </main>
  </TooltipProvider>
</template>
