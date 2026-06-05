<template lang="pug">
BaseCard.mp-onboarding-gate
  .mp-onboarding-gate__header
    q-icon(name="handshake", size="28px", color="primary")
    div
      .text-h6 {{ title }}
      .text-caption.text-grey-7(v-if="subtitle") {{ subtitle }}

  q-separator.q-my-md

  .text-body2.q-mb-md {{ leadText }}

  q-list
    q-item(v-for="d in documents", :key="d.id", tag="label", v-ripple)
      q-item-section(avatar)
        BaseCheckbox(v-model="accepted[d.id]", :disabled="d.required && d.locked")
      q-item-section
        q-item-label
          BaseChip.q-mr-xs(v-if="d.required", variant="warn", size="sm") Обязательно
          | {{ d.title }}
        q-item-label(caption, v-if="d.description") {{ d.description }}
      q-item-section(side, v-if="d.url")
        BaseButton(variant="ghost", icon-only, aria-label="Открыть документ", @click.prevent="openDoc(d)")
          template(#icon-left)
            q-icon(name="visibility")

  q-separator.q-my-md

  .mp-onboarding-gate__actions
    BaseButton(variant="ghost", @click="$emit('decline')") Отказаться
    BaseButton(
      variant="primary",
      :disabled="!allRequiredAccepted || confirmDisabled || busy",
      :loading="busy",
      @click="$emit('accept', acceptedDocs)"
    ) {{ confirmLabel }}
</template>

<script setup lang="ts">
import { computed, reactive, type PropType } from 'vue'
import { BaseCard, BaseButton, BaseCheckbox, BaseChip } from 'src/shared/ui/base'

export interface CPPDocument {
  id: string
  title: string
  description?: string
  url?: string
  required?: boolean
  locked?: boolean
}

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  leadText: { type: String, default: 'Ознакомьтесь с пакетом документов и подтвердите согласие.' },
  documents: { type: Array as PropType<CPPDocument[]>, required: true },
  confirmLabel: { type: String, default: 'Принять и продолжить' },
  busy: { type: Boolean, default: false },
  // Внешнее условие блокировки подтверждения (помимо согласия с документами):
  // напр., пока заказчик не выбрал КУ на экране присоединения (Story 16.4).
  confirmDisabled: { type: Boolean, default: false },
})

defineEmits<{
  (e: 'accept', accepted: string[]): void
  (e: 'decline'): void
}>()

const accepted = reactive<Record<string, boolean>>(
  Object.fromEntries(props.documents.map((d) => [d.id, !!d.locked]))
)

const allRequiredAccepted = computed(() =>
  props.documents.filter((d) => d.required).every((d) => accepted[d.id])
)

const acceptedDocs = computed(() =>
  Object.entries(accepted).filter(([, v]) => v).map(([k]) => k)
)

function openDoc(d: CPPDocument) {
  if (d.url) window.open(d.url, '_blank', 'noopener')
}
</script>

<style scoped lang="scss">
.mp-onboarding-gate {
  max-width: 720px;

  &__header {
    display: flex;
    gap: var(--p-3, 12px);
    align-items: center;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
  }
}
</style>
