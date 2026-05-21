<script setup lang="ts">
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import AppButton from '../components/ui/AppButton.vue'
import {authClient} from '../lib/auth-client'

const router = useRouter()
const mode = ref<'sign-in' | 'sign-up'>('sign-in')
const name = ref('')
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function submit() {
  errorMessage.value = ''
  loading.value = true

  try {
    if (mode.value === 'sign-up') {
      const result = await authClient.signUp.email({
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
      })

      if (result.error) {
        errorMessage.value = result.error.message ?? 'Could not create account.'
        return
      }
    } else {
      const result = await authClient.signIn.email({
        email: email.value.trim(),
        password: password.value,
      })

      if (result.error) {
        errorMessage.value = result.error.message ?? 'Could not sign in.'
        return
      }
    }

    await router.push('/')
  } catch {
    errorMessage.value = 'Authentication failed.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-md">
    <h2 class="text-2xl font-semibold">{{ mode === 'sign-in' ? 'Sign in' : 'Create account' }}</h2>
    <p class="mt-1 text-sm text-slate-500">Email and password auth via Better Auth.</p>

    <form class="mt-6 grid gap-4" @submit.prevent="submit">
      <label v-if="mode === 'sign-up'" class="grid gap-1.5 text-sm">
        <span>Name</span>
        <input
          v-model="name"
          class="min-h-10 rounded-md border border-slate-300 px-3"
          required
          autocomplete="name"
        />
      </label>

      <label class="grid gap-1.5 text-sm">
        <span>Email</span>
        <input
          v-model="email"
          class="min-h-10 rounded-md border border-slate-300 px-3"
          type="email"
          required
          autocomplete="email"
        />
      </label>

      <label class="grid gap-1.5 text-sm">
        <span>Password</span>
        <input
          v-model="password"
          class="min-h-10 rounded-md border border-slate-300 px-3"
          type="password"
          required
          minlength="8"
          autocomplete="current-password"
        />
      </label>

      <p v-if="errorMessage" class="text-sm text-red-700">{{ errorMessage }}</p>

      <AppButton type="submit" :disabled="loading">
        {{ mode === 'sign-in' ? 'Sign in' : 'Create account' }}
      </AppButton>
    </form>

    <p class="mt-4 text-sm text-slate-600">
      <button
        class="text-slate-900 underline"
        type="button"
        @click="mode = mode === 'sign-in' ? 'sign-up' : 'sign-in'"
      >
        {{ mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in' }}
      </button>
    </p>
  </section>
</template>
