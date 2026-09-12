import {createAuthClient} from 'better-auth/vue'
import {apiUrl} from './api-url'

export const authClient = createAuthClient({
  baseURL: apiUrl,
})
