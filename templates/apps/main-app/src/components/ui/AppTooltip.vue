<script setup lang="ts">
import {TooltipArrow, TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger} from 'reka-ui'

defineProps<{
  label: string
}>()
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>

    <TooltipPortal>
      <TooltipContent
        class="z-50 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-md"
        :side-offset="6"
      >
        {{ label }}
        <TooltipArrow class="fill-slate-900" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
