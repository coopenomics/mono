<template>
  <q-dialog
    v-model="open"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card
      class="mp-takeover"
      :class="`mp-takeover--${kind}`"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="leadText ? leadId : undefined"
    >
      <div class="mp-takeover__bar">
        <q-btn
          flat
          dense
          round
          icon="fa-solid fa-xmark"
          class="mp-takeover__close"
          aria-label="Закрыть"
          @click="onCancel"
        />
        <q-icon v-if="kindIcon" :name="kindIcon" :class="`mp-takeover__icon mp-takeover__icon--${kind}`" />
        <div :id="titleId" class="mp-takeover__title">{{ title }}</div>
        <q-space />
      </div>

      <q-card-section class="mp-takeover__body" :class="{ 'mp-takeover__body--wide': wide }">
        <div v-if="leadText" :id="leadId" class="mp-takeover__lead">{{ leadText }}</div>
        <slot />
      </q-card-section>

      <q-separator />

      <q-card-actions class="mp-takeover__actions" align="right">
        <slot name="actions" :cancel="onCancel" :confirm="onConfirm">
          <q-btn flat no-caps :label="cancelLabel" @click="onCancel" />
          <q-btn
            unelevated
            no-caps
            :color="confirmColor"
            :label="confirmLabel"
            :loading="loading"
            :disable="disableConfirm"
            class="mp-takeover__confirm"
            @click="onConfirm"
          />
        </slot>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, useId, type PropType } from 'vue'

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
  // Полноширинный контент для takeover'ов с таблицами (сводная выдача,
  // приёмка): многоколоночная сверка не должна упираться в max-width. Дефолт не меняется.
  wide: { type: Boolean, default: false },
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

const uid = useId()
const titleId = `mp-takeover-title-${uid}`
const leadId = `mp-takeover-lead-${uid}`

const KIND_MAP: Record<TakeoverKind, { icon: string; confirmColor: string }> = {
  info:    { icon: 'fa-solid fa-circle-info',          confirmColor: 'primary'  },
  success: { icon: 'fa-solid fa-circle-check',         confirmColor: 'positive' },
  warning: { icon: 'fa-solid fa-triangle-exclamation', confirmColor: 'warning'  },
  danger:  { icon: 'fa-solid fa-circle-exclamation',   confirmColor: 'negative' },
}

const kindIcon = computed(() => KIND_MAP[props.kind].icon)
const confirmColor = computed(() => KIND_MAP[props.kind].confirmColor)

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
  background: var(--mp-surface-0);
  color: var(--mp-on-surface);

  &__bar {
    display: flex;
    align-items: center;
    gap: var(--mp-space-md);
    height: 64px;
    padding: 0 var(--mp-space-lg);
    border-bottom: 1px solid var(--mp-border-subtle);
  }

  &__close {
    color: var(--mp-on-surface-muted);
  }

  &__icon {
    font-size: 22px;
    color: var(--q-primary);

    &--success { color: var(--q-positive); }
    &--warning { color: var(--q-warning); }
    &--danger  { color: var(--q-negative); }
  }

  &__title {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -.01em;
    color: var(--mp-on-surface);
  }

  &__body {
    flex: 1;
    overflow: auto;
    padding: var(--mp-space-xl) var(--mp-space-lg);
    max-width: 720px;
    margin: 0 auto;
    width: 100%;

    &--wide {
      max-width: none;
    }
  }

  &__lead {
    font-size: 15px;
    color: var(--mp-on-surface-muted);
    margin-bottom: var(--mp-space-md);
  }

  &__actions {
    padding: var(--mp-space-md) var(--mp-space-lg);
    gap: var(--mp-space-sm);
  }

  &__confirm {
    border-radius: var(--mp-radius-sm);
    box-shadow: none !important;
  }
}
</style>
