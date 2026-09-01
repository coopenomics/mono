<template lang="pug">
//- Текстовая кнопка «Редакции» + всплывающее окно истории (для страниц с автосохранением)
span
  BaseButton(variant="ghost" size="sm" @click="open = true") Редакции
  RevisionsDialog(
    v-model="open"
    :entity-type="entityType"
    :entity-hash="entityHash"
    :current-title="currentTitle"
    :current-description="currentDescription"
    :current-rev="currentRev"
    :can-restore="canEdit"
    @restored="(s) => emit('restored', s)"
  )
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BaseButton } from 'src/shared/ui/base'
import RevisionsDialog from './RevisionsDialog.vue'
import type { IContentEntityType, IContentRevisionSummary } from '../api'

defineProps<{
  entityType: IContentEntityType
  entityHash: string
  currentTitle: string
  currentDescription: string
  currentRev: number
  canEdit: boolean
}>()

const emit = defineEmits<{
  restored: [summary: IContentRevisionSummary]
}>()

const open = ref(false)
</script>
