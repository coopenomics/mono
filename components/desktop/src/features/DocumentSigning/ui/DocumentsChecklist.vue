<template lang="pug">
.documents-checklist.q-gutter-sm
  template(v-for='doc in documents', :key='doc.id')
    q-checkbox(
      :model-value='doc.accepted',
      @update:model-value='(val) => emit("update:accepted", doc.id, val)'
    ).full-width
      | {{ doc.checkbox_text }}
      ReadAgreementDialog(
        v-if='doc.link_text',
        :agree='doc.accepted',
        @update:agree='(val) => emit("update:accepted", doc.id, val)',
        :text='doc.link_text'
      )
        // eslint-disable-next-line vue/no-v-html
        div(v-html='doc.document.html').q-mb-lg
</template>

<script lang="ts" setup>
import { ReadAgreementDialog } from 'src/features/Agreementer/ReadAgreementDialog'
import type { ISigningDocument } from '../model/types'

defineProps<{
  documents: ISigningDocument[]
}>()

const emit = defineEmits<{
  'update:accepted': [id: string, value: boolean]
}>()
</script>
