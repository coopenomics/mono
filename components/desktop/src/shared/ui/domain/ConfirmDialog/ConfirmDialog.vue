<template lang="pug">
BaseDialog(
  :model-value="state.open"
  :title="state.options.title"
  size="sm"
  :close-on-backdrop="false"
  @update:model-value="(v) => !v && answer(false)"
)
  .text-body2(v-if="state.options.message") {{ state.options.message }}
  BaseBanner.q-mt-md(v-if="state.options.note" variant="warn")
    template(#icon)
      q-icon(name="warning_amber")
    | {{ state.options.note }}
  .row.justify-end.q-gutter-sm.q-mt-lg
    BaseButton(variant="ghost" @click="answer(false)") {{ state.options.cancelLabel || 'Отмена' }}
    BaseButton(:variant="state.options.danger ? 'danger' : 'primary'" @click="answer(true)") {{ state.options.confirmLabel || 'Подтвердить' }}
</template>

<script setup lang="ts">
import { useConfirmState } from 'src/shared/lib/composables';
import { BaseBanner, BaseButton, BaseDialog } from 'src/shared/ui/base';

/**
 * Окно подтверждения платформы: живёт одно на всё приложение глобальным
 * оверлеем и показывается по вызову `useConfirm().confirm(...)`. Системный
 * `window.confirm` и самодельные диалоги «вы уверены?» заменяет оно.
 */
const { state, answer } = useConfirmState();
</script>
