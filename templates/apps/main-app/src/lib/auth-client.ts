import {createAuthClient} from 'better-auth/vue'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL ?? window.location.origin,
})
