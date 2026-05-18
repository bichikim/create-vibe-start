<script setup lang="ts">
import {TooltipProvider} from 'reka-ui'
</script>

<template>
  <TooltipProvider>
    <main class="mx-auto max-w-3xl px-5 py-12 text-slate-900">
      <header class="mb-8 flex items-center justify-between gap-5 max-sm:flex-col max-sm:items-stretch">
        <div>
          <p class="mb-1.5 text-sm text-slate-500">Nitro + Vue + oRPC + Drizzle</p>
          <h1 class="text-4xl leading-none font-semibold">Vibe Start</h1>
        </div>

        <nav class="flex gap-2">
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
        </nav>
      </header>

      <RouterView />
    </main>
  </TooltipProvider>
</template>
