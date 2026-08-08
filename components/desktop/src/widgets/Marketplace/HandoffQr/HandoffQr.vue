<script setup lang="ts">
import { ref, watch } from 'vue';
import QRCode from 'qrcode';
import { copyToClipboard } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseButton } from 'src/shared/ui/base';

/**
 * Эпик 14 / Story 14.3, 14.4: QR-код передачи на ПВЗ.
 *
 * Один переиспользуемый компонент для обоих сценариев:
 *  - поставщик показывает QR партии оператору приёмки (value = shipment_id);
 *  - заказчик показывает QR заказа оператору выдачи (value = order id).
 *
 * QR кодирует идентификатор — оператор сканирует и сразу видит, что
 * принять / выдать. Под QR — тот же код текстом (копируемый) как запасной
 * путь, если камера недоступна.
 */

const props = withDefaults(
  defineProps<{
    value: string;
    caption?: string;
    size?: number;
  }>(),
  { caption: '', size: 240 },
);

const dataUrl = ref('');
const failed = ref(false);

async function render(): Promise<void> {
  failed.value = false;
  if (!props.value) {
    dataUrl.value = '';
    return;
  }
  try {
    dataUrl.value = await QRCode.toDataURL(props.value, {
      margin: 1,
      width: props.size,
      errorCorrectionLevel: 'M',
    });
  } catch {
    failed.value = true;
    dataUrl.value = '';
  }
}

watch(() => [props.value, props.size], render, { immediate: true });

async function copyCode(): Promise<void> {
  try {
    await copyToClipboard(props.value);
    SuccessAlert('Код скопирован');
  } catch (e) {
    FailAlert(e, 'Не удалось скопировать код');
  }
}
</script>

<template lang="pug">
.handoff-qr
  .handoff-qr__frame(:style='{ width: size + "px", height: size + "px" }')
    img.handoff-qr__img(v-if='dataUrl', :src='dataUrl', alt='QR-код передачи')
    .handoff-qr__fallback(v-else-if='failed')
      q-icon(name='error_outline', size='32px')
      span Не удалось построить QR
  .handoff-qr__caption(v-if='caption') {{ caption }}
  .handoff-qr__code
    code.handoff-qr__code-text {{ value }}
    BaseButton(variant='ghost', size='sm', icon-only, aria-label='Скопировать код', @click='copyCode')
      template(#icon-left)
        q-icon(name='content_copy', size='16px')
</template>

<style scoped lang="scss">
.handoff-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-3, 12px);

  &__frame {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-2, 8px);
  }

  &__img {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  &__fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--p-2, 8px);
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
    text-align: center;
  }

  &__caption {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    text-align: center;
    max-width: 320px;
    line-height: 1.4;
  }

  &__code {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    max-width: 100%;
  }

  &__code-text {
    font-family: var(--font-mono);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    overflow-wrap: anywhere;
    background: var(--p-surface-2, var(--p-surface));
    padding: 2px 8px;
    border-radius: var(--p-r-sm, 8px);
  }
}
</style>
