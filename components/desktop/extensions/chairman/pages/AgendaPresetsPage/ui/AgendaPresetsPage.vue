<template lang="pug">
div
  q-card(flat)
    q-card-section
      .text-h5 Пресеты предложений повестки
      .text-caption Генерация документов для предложения повестки совета

    q-separator

    q-card-section
      q-list(separator)
        q-item(v-for="preset in presets" :key="preset.id")
          q-item-section
            q-item-label {{ preset.title }}
            q-item-label(caption) {{ preset.description }}
          q-item-section(side)
            q-btn(
              color="primary"
              label="Сгенерировать"
              :loading="loading"
              @click="() => generateDocument(preset)"
            )

  BaseDialog(
    v-model="showDialog",
    title="Предложение повестки",
    size="lg",
    :close-on-backdrop="false",
    :close-on-escape="false",
    @update:model-value="(v) => !v && closeDialog()"
  )
    q-card-section(v-if="currentPreset && generatedDocument")
      div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium.q-mb-md
        q-icon(name="help_outline" size="18px" class="text-primary")
        span Вопрос на повестке
      div.q-mb-md.q-pa-sm.text-body1.rounded-borders {{ currentPreset.question }}

      q-separator.q-my-md

      div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium.q-mb-md
        q-icon(name="gavel" size="18px" class="text-primary")
        span Проект решения
      div.q-pa-sm.rounded-borders(style="max-height: 400px; overflow-y: auto;")
        div(v-if="currentPreset") {{ currentPreset.decisionPrefix }}
        div(v-if="currentPreset").q-mt-md
        DocumentHtmlReader(:html="generatedDocument.html" :sanitize="false")
      div.q-mt-sm.text-caption.text-grey-6
        strong {{ generatedDocument.full_title }}

    div.q-pb-lg
      q-btn(flat label="Отмена" @click="closeDialog" :disable="submitting")
      q-btn(
        color="primary"
        label="Создать предложение"
        :loading="submitting"
        @click="handleSubmit"
      )
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader'
import { BaseDialog } from 'src/shared/ui/base/BaseDialog'
import { useAgendaPresets, useBlagorostPresets } from 'app/extensions/chairman/features/AgendaPresets'
import { useSessionStore } from 'src/entities/Session'

const route = useRoute()
const sessionStore = useSessionStore()
const presets = useBlagorostPresets()

const {
  loading,
  submitting,
  generatedDocument,
  currentPreset,
  showDialog,
  generateDocument,
  submitProposal,
  closeDialog,
} = useAgendaPresets()

const handleSubmit = async () => {
  const coopname = route.params.coopname as string
  const username = sessionStore.username
  await submitProposal(coopname, username)
}
</script>
