import {createRouter, createWebHistory} from 'vue-router'
import AboutView from './views/AboutView.vue'
import BillingCancelView from './views/BillingCancelView.vue'
import BillingSuccessView from './views/BillingSuccessView.vue'
import BillingView from './views/BillingView.vue'
import LoginView from './views/LoginView.vue'
import NotesView from './views/NotesView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'notes',
      component: NotesView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
    },
    {
      path: '/billing',
      name: 'billing',
      component: BillingView,
    },
    {
      path: '/billing/success',
      name: 'billing-success',
      component: BillingSuccessView,
    },
    {
      path: '/billing/cancel',
      name: 'billing-cancel',
      component: BillingCancelView,
    },
  ],
})
