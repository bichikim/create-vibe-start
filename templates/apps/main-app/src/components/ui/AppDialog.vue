<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'

const open = defineModel<boolean>('open')

defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-slate-950/35" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-50 grid w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div>
          <DialogTitle class="text-lg font-semibold text-slate-900">{{ title }}</DialogTitle>
          <DialogDescription v-if="description" class="mt-1 text-sm text-slate-500">
            {{ description }}
          </DialogDescription>
        </div>

        <slot />

        <DialogClose
          class="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close"
        >
          x
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
