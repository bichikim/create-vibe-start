<script setup lang="ts">
import {cva, type VariantProps} from 'class-variance-authority'
import {Primitive, type PrimitiveProps} from 'reka-ui'
import {computed} from 'vue'

const buttonClass = cva(
  [
    'inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-medium',
    'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'border-slate-900 bg-slate-900 text-white hover:bg-slate-700',
        secondary: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        ghost: 'border-transparent text-slate-600 hover:bg-slate-100',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
)

type ButtonVariants = VariantProps<typeof buttonClass>

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      variant?: ButtonVariants['variant']
      class?: string
    }
  >(),
  {
    as: 'button',
    variant: 'primary',
  },
)

const classes = computed(() => [buttonClass({variant: props.variant}), props.class])
</script>

<template>
  <Primitive :as="as" :as-child="asChild" :class="classes">
    <slot />
  </Primitive>
</template>
