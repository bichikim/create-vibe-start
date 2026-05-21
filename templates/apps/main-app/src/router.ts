import {createRouter, createWebHistory} from 'vue-router'
import AboutView from './views/AboutView.vue'
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
  ],
})
