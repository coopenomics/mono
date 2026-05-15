<template>
  <q-dialog
    v-model="open"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="mp-takeover">
      <div class="mp-takeover__bar" :class="`bg-${kindColor}`">
        <q-btn flat dense round icon="fa-solid fa-xmark" color="white" @click="onCancel" />
        <div class="text-h6 text-white q-ml-md">{{ title }}</div>
        <q-space />
        <q-icon v-if="kindIcon" :name="kindIcon" color="white" size="24px" />
      </div>

      <q-card-section class="mp-takeover__body">
        <div v-if="leadText" class="text-body1 q-mb-md">{{ leadText }}</div>
        <slot />
      </q-card-section>

      <q-separator />

      <q-card-actions class="mp-takeover__actions" align="right">
        <slot name="actions" :cancel="onCancel" :confirm="onConfirm">
          <q-btn flat :label="cancelLabel" @click="onCancel" />
          <q-btn
            unelevated
            :color="kind === 'danger' ? 'negative' : 'primary'"
            :label="confirmLabel"
            :loading="loading"
            :disable="disableConfirm"
            @click="onConfirm"
          />
        </slot>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'

export type TakeoverKind = 'info' | 'success' | 'warning' | 'danger'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  leadText: { type: String, default: '' },
  kind: { type: String as PropType<TakeoverKind>, default: 'info' },
  cancelLabel: { type: String, default: 'Отмена' },
  confirmLabel: { type: String, default: 'Подтвердить' },
  loading: { type: Boolean, default: false },
  disableConfirm: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'cancel'): void
  (e: 'confirm'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const KIND_MAP: Record<TakeoverKind, { color: string; icon: string }> = {
  info:    { color: 'primary',  icon: 'fa-solid fa-circle-info' },
  success: { color: 'positive', icon: 'fa-solid fa-circle-check' },
  warning: { color: 'warning',  icon: 'fa-solid fa-triangle-exclamation' },
  danger:  { color: 'negative', icon: 'fa-solid fa-circle-exclamation' },
}

const kindColor = computed(() => KIND_MAP[props.kind].color)
const kindIcon = computed(() => KIND_MAP[props.kind].icon)

function onCancel() {
  emit('cancel')
  open.value = false
}

function onConfirm() {
  emit('confirm')
}
</script>

<style scoped lang="scss">
.mp-takeover {
  display: flex;
  flex-direction: column;
  height: 100vh;

  &__bar {
    display: flex;
    align-items: center;
    height: 64px;
    padding: 0 var(--mp-space-md);
  }

  &__body {
    flex: 1;
    overflow: auto;
    padding: var(--mp-space-lg);
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
  }

  &__actions {
    padding: var(--mp-space-md) var(--mp-space-lg);
  }
}
</style>
