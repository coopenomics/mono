<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef } from 'vue';
import { BaseButton, BaseInput } from 'src/shared/ui/base';

/**
 * Эпик 14 / Story 14.3, 14.4: сканер QR-кода передачи на ПВЗ.
 *
 * Переиспользуется оператором приёмки (партия) и оператором выдачи (заказ).
 * Декодирование — нативный `BarcodeDetector` (Chromium), без внешних
 * зависимостей. Если API/камера недоступны — ручной ввод кода как запасной
 * путь (тот же код напечатан под QR у показывающего).
 */

const emit = defineEmits<{
  (e: 'scanned', code: string): void;
}>();

type ScanState = 'idle' | 'requesting' | 'scanning' | 'error';

const state = ref<ScanState>('idle');
const errorMessage = ref('');
const manualCode = ref('');

const video = useTemplateRef<HTMLVideoElement>('video');

let stream: MediaStream | null = null;
let detector: BarcodeDetector | null = null;
let rafId: number | null = null;
let stopped = false;

const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

function teardown(): void {
  stopped = true;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
}

async function tick(): Promise<void> {
  if (stopped || !detector || !video.value) return;
  try {
    const codes = await detector.detect(video.value);
    const hit = codes.find((c) => c.rawValue);
    if (hit) {
      teardown();
      state.value = 'idle';
      emit('scanned', hit.rawValue.trim());
      return;
    }
  } catch {
    // Кадр мог быть не готов — продолжаем цикл, не падая.
  }
  rafId = requestAnimationFrame(() => void tick());
}

async function start(): Promise<void> {
  errorMessage.value = '';
  if (!supported) {
    state.value = 'error';
    errorMessage.value = 'Камера-сканер недоступна в этом браузере — введите код вручную.';
    return;
  }
  state.value = 'requesting';
  stopped = false;
  try {
    detector = new BarcodeDetector({ formats: ['qr_code'] });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    if (stopped) {
      teardown();
      return;
    }
    if (video.value) {
      video.value.srcObject = stream;
      await video.value.play();
    }
    state.value = 'scanning';
    rafId = requestAnimationFrame(() => void tick());
  } catch {
    teardown();
    state.value = 'error';
    errorMessage.value = 'Не удалось получить доступ к камере — введите код вручную.';
  }
}

function stop(): void {
  teardown();
  state.value = 'idle';
}

function submitManual(): void {
  const code = manualCode.value.trim();
  if (!code) return;
  teardown();
  state.value = 'idle';
  emit('scanned', code);
  manualCode.value = '';
}

onBeforeUnmount(teardown);

defineExpose({ start, stop });
</script>

<template lang="pug">
.qr-scanner
  .qr-scanner__viewport
    video.qr-scanner__video(
      ref='video',
      v-show='state === "scanning"',
      muted,
      playsinline
    )
    .qr-scanner__overlay(v-if='state === "idle"')
      q-icon.qr-scanner__muted(name='qr_code_scanner', size='56px')
      .qr-scanner__caption Наведите камеру на QR-код передачи
      BaseButton(variant='primary', size='sm', @click='start') Включить камеру
    .qr-scanner__overlay(v-else-if='state === "requesting"')
      q-spinner(color='primary', size='40px')
      .qr-scanner__caption Запрос доступа к камере…
    .qr-scanner__frame(v-else-if='state === "scanning"')
      .qr-scanner__corners
      .qr-scanner__hint Поместите QR-код в рамку
    .qr-scanner__overlay(v-else-if='state === "error"')
      q-icon(name='videocam_off', size='48px')
      .qr-scanner__caption {{ errorMessage }}

  q-btn.qr-scanner__stop(
    v-if='state === "scanning"',
    flat,
    no-caps,
    dense,
    color='primary',
    label='Остановить',
    @click='stop'
  )

  //- Запасной путь: ручной ввод кода (тот же, что напечатан под QR).
  .qr-scanner__manual
    BaseInput.qr-scanner__manual-input(
      v-model='manualCode',
      label='Или введите код вручную',
      placeholder='идентификатор',
      mono,
      @keyup.enter='submitManual'
    )
    BaseButton(variant='secondary', size='sm', :disabled='!manualCode.trim()', @click='submitManual') Применить
</template>

<style scoped lang="scss">
.qr-scanner {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__viewport {
    position: relative;
    width: 100%;
    max-width: 420px;
    aspect-ratio: 4 / 3;
    margin: 0 auto;
    background: var(--p-ink);
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
  }

  &__video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--p-3, 12px);
    padding: var(--p-4, 16px);
    text-align: center;
    color: #fff;
  }

  &__muted {
    color: rgba(255, 255, 255, 0.6);
  }

  &__caption {
    font-size: var(--p-fs-body-sm, 13px);
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.4;
  }

  &__frame {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__corners {
    width: 60%;
    height: 60%;
    border: 2px solid rgba(255, 255, 255, 0.85);
    border-radius: var(--p-r-sm, 8px);
  }

  &__hint {
    position: absolute;
    bottom: var(--p-3, 12px);
    width: 100%;
    text-align: center;
    font-size: var(--p-fs-body-sm, 13px);
    color: rgba(255, 255, 255, 0.85);
  }

  &__stop {
    align-self: center;
  }

  &__manual {
    display: flex;
    align-items: flex-end;
    gap: var(--p-2, 8px);
  }

  &__manual-input {
    flex: 1 1 auto;
  }
}
</style>
