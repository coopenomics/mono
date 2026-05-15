<template>
  <q-card flat bordered class="mp-onboarding-gate">
    <q-card-section class="mp-onboarding-gate__header">
      <q-icon name="fa-solid fa-handshake" size="32px" color="primary" />
      <div>
        <div class="text-h6">{{ title }}</div>
        <div class="text-caption text-grey-7">{{ subtitle }}</div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-body2 q-mb-md">{{ leadText }}</div>

      <q-list>
        <q-item v-for="d in documents" :key="d.id" tag="label" v-ripple>
          <q-item-section avatar>
            <q-checkbox v-model="accepted[d.id]" :disable="d.required && d.locked" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              <span v-if="d.required" class="mp-status-chip mp-status-chip--warning mp-onboarding-gate__required">
                Обязательно
              </span>
              {{ d.title }}
            </q-item-label>
            <q-item-label caption v-if="d.description">{{ d.description }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn flat dense color="primary" icon="fa-solid fa-eye" @click.prevent="openDoc(d)" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <q-separator />

    <q-card-actions align="right" class="q-pa-md">
      <q-btn flat label="Отказаться" color="grey-7" @click="$emit('decline')" />
      <q-btn
        unelevated
        color="primary"
        :label="confirmLabel"
        :disable="!allRequiredAccepted"
        @click="$emit('accept', acceptedDocs)"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { computed, reactive, type PropType } from 'vue'

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
  border-radius: var(--mp-radius-md);
  border: 1px solid var(--mp-border-subtle);
  box-shadow: none;

  &__header {
    display: flex;
    gap: var(--mp-space-md);
    align-items: center;
  }

  &__required {
    margin-right: 6px;
    vertical-align: 1px;
  }
}
</style>
