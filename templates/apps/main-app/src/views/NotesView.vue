<script setup lang="ts">
import {useMutation, useQuery, useQueryCache} from '@pinia/colada'
import {computed, ref} from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppDialog from '../components/ui/AppDialog.vue'
import AppTooltip from '../components/ui/AppTooltip.vue'
import {orpc} from '../orpc'

const notesKey = ['notes']
const text = ref('')
const addDialogOpen = ref(false)
const queryCache = useQueryCache()

const notesQuery = useQuery({
  key: notesKey,
  query: () => orpc.notes.list(),
})

const notes = computed(() => notesQuery.data.value ?? [])

const createNote = useMutation({
  mutation: (nextText: string) => orpc.notes.create({text: nextText}),
  onSettled() {
    text.value = ''
    queryCache.invalidateQueries({key: notesKey, exact: true})
  },
})

function submitNote() {
  const nextText = text.value.trim()
  if (nextText) {
    createNote.mutate(nextText)
    addDialogOpen.value = false
  }
}
</script>

<template>
  <section>
    <div class="mb-6 flex items-center justify-between gap-5 max-sm:flex-col max-sm:items-stretch">
      <div>
        <h2 class="text-2xl font-semibold">Notes</h2>
        <p class="mt-1 text-sm text-slate-500">Data is cached and invalidated through Pinia Colada.</p>
      </div>
      <div class="flex gap-2">
        <AppDialog
          v-model:open="addDialogOpen"
          title="Add note"
          description="Save a short note through the oRPC notes router."
        >
          <template #trigger>
            <AppButton type="button">Add note</AppButton>
          </template>

          <form class="grid gap-4" @submit.prevent="submitNote">
            <input
              v-model="text"
              class="min-h-10 min-w-0 rounded-md border border-slate-300 px-3"
              maxlength="240"
              placeholder="Write a note"
              aria-label="Note text"
            />
            <div class="flex justify-end gap-2">
              <AppButton type="button" variant="secondary" @click="addDialogOpen = false">Cancel</AppButton>
              <AppButton type="submit" :disabled="createNote.asyncStatus.value === 'loading' || !text.trim()">
                Save
              </AppButton>
            </div>
          </form>
        </AppDialog>

        <AppTooltip label="Reload notes">
          <AppButton
            type="button"
            variant="secondary"
            :disabled="notesQuery.asyncStatus.value === 'loading'"
            @click="notesQuery.refetch()"
          >
            Refresh
          </AppButton>
        </AppTooltip>
      </div>
    </div>

    <p v-if="notesQuery.error.value || createNote.error.value" class="my-4 text-red-700">Could not sync notes.</p>
    <p v-else-if="notesQuery.asyncStatus.value === 'loading' && notes.length === 0" class="my-4 text-slate-500">
      Loading notes...
    </p>
    <p v-else-if="notes.length === 0" class="my-4 text-slate-500">No notes yet.</p>

    <ul class="grid gap-2.5">
      <li v-for="note in notes" :key="note.id" class="grid gap-2 rounded-lg border border-slate-200 bg-white p-3.5">
        <span v-text="note.text"></span>
        <time class="text-sm text-slate-500" v-text="new Date(note.createdAt).toLocaleString()"></time>
      </li>
    </ul>
  </section>
</template>
