<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef } from 'vue';
import { BaseButton, BaseInput } from 'src/shared/ui/base';

/**
 * Единый сканер кодов камерой устройства (QR и 1D штрих-коды).
 *
 * Декодирование — нативный `BarcodeDetector` (Chromium), без внешних
 * зависимостей; он распознаёт и QR (`qr_code`), и линейные штрих-коды
 * (`ean_13`, `code_128`, …) — поэтому один компонент на оба сценария
 * (приёмка/выдача по QR передачи и привязка/сверка штрих-кода имущества).
 * Если API/камера недоступны — ручной ввод кода как запасной путь.
 *
 * Параметризуется форматами и подписями: `formats` сужает набор кодов под
 * задачу (по умолчанию только QR), тексты подстраивают подсказки под контекст.
 */

const props = withDefaults(
  defineProps<{
    /** Какие коды распознавать (значения BarcodeDetector). По умолчанию — только QR. */
    formats?: string[];
    /** Подпись на старте (idle), пока камера не включена. */
    idleCaption?: string;
    /** Подсказка в рамке во время сканирования. */
    frameHint?: string;
    /** Метка кнопки включения камеры. */
    startLabel?: string;
    /** Метка поля ручного ввода (запасной путь). */
    manualLabel?: string;
    /** Плейсхолдер поля ручного ввода. */
    manualPlaceholder?: string;
    /** Метка кнопки применения ручного ввода. */
    manualButton?: string;
  }>(),
  {
    formats: () => ['qr_code'],
    idleCaption: 'Наведите камеру на QR-код передачи',
    frameHint: 'Поместите QR-код в рамку',
    startLabel: 'Включить камеру',
    manualLabel: 'Или введите код вручную',
    manualPlaceholder: 'идентификатор',
    manualButton: 'Применить',
  },
);

const emit = defineEmits<{
  (e: 'scanned', code: string): void;
}>();

type ScanState = 'idle' | 'requesting' | 'scanning' | 'error';

/**
 * `BarcodeDetector` — нативный Web API (Chromium), в lib.dom его типов пока нет.
 * Узкий локальный тип под единственное использование — без глобальных shims и
 * без @types-пакета.
 */
interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource | Blob | ImageData): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const DetectorCtor =
  typeof window !== 'undefined'
    ? (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
    : undefined;
const supported = Boolean(DetectorCtor);

const state = ref<ScanState>('idle');
const errorMessage = ref('');
const manualCode = ref('');

const video = useTemplateRef<HTMLVideoElement>('video');

let stream: MediaStream | null = null;
let detector: BarcodeDetectorLike | null = null;
let rafId: number | null = null;
let stopped = false;

/**
 * Таймаут запроса камеры. На ноутбуке без разрешений / при блокировке
 * Permissions-Policy `getUserMedia` может «висеть» не отвергаясь — спиннер
 * крутится бесконечно. По истечении лимита глушим запрос и показываем ошибку
 * с запасным ручным вводом, не оставляя оператора в вечном ожидании.
 */
const REQUEST_TIMEOUT_MS = 12000;
let requestTimer: ReturnType<typeof setTimeout> | null = null;

function clearRequestTimer(): void {
  if (requestTimer !== null) {
    clearTimeout(requestTimer);
    requestTimer = null;
  }
}

function teardown(): void {
  stopped = true;
  clearRequestTimer();
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
  requestTimer = setTimeout(() => {
    if (state.value !== 'requesting') return;
    teardown();
    state.value = 'error';
    errorMessage.value = 'Камера не ответила — введите код вручную.';
  }, REQUEST_TIMEOUT_MS);
  try {
    detector = new DetectorCtor!({ formats: props.formats });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    if (stopped) {
      teardown();
      return;
    }
    clearRequestTimer();
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
.code-scanner
  .code-scanner__viewport
    video.code-scanner__video(
      ref='video',
      v-show='state === "scanning"',
      muted,
      playsinline
    )
    .code-scanner__overlay(v-if='state === "idle"')
      q-icon.code-scanner__muted(name='qr_code_scanner', size='56px')
      .code-scanner__caption {{ idleCaption }}
      BaseButton(variant='primary', size='sm', @click='start') {{ startLabel }}
    .code-scanner__overlay(v-else-if='state === "requesting"')
      q-spinner(color='primary', size='40px')
      .code-scanner__caption Запрос доступа к камере…
    .code-scanner__frame(v-else-if='state === "scanning"')
      .code-scanner__corners
      .code-scanner__hint {{ frameHint }}
    .code-scanner__overlay(v-else-if='state === "error"')
      q-icon(name='videocam_off', size='48px')
      .code-scanner__caption {{ errorMessage }}

  q-btn.code-scanner__stop(
    v-if='state === "scanning"',
    flat,
    no-caps,
    dense,
    color='primary',
    label='Остановить',
    @click='stop'
  )

  //- Запасной путь: ручной ввод кода (USB-сканер тоже «набирает» сюда + Enter).
  .code-scanner__manual
    BaseInput.code-scanner__manual-input(
      v-model='manualCode',
      :label='manualLabel',
      :placeholder='manualPlaceholder',
      mono,
      @keyup.enter='submitManual'
    )
    BaseButton(variant='secondary', size='sm', :disabled='!manualCode.trim()', @click='submitManual') {{ manualButton }}
</template>

<style scoped lang="scss">
.code-scanner {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__viewport {
    position: relative;
    width: 100%;
    max-width: 420px;
    aspect-ratio: 4 / 3;
    margin: 0 auto;
    //- Поверхность из канона: следует за темой. НЕ `--p-ink` — он
    //- инвертируется (в тёмной теме светлый), отчего бокс камеры белеет,
    //- а белый текст/иконка на нём становятся невидимыми.
    background: var(--p-surface-2);
    border: 1px solid var(--p-line);
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
    //- Текст оверлея (idle/requesting/error) — на канон-поверхности, поэтому
    //- ink-токены, а не белый: читается в обеих темах.
    color: var(--p-ink-2);
  }

  &__muted {
    color: var(--p-ink-3);
  }

  &__caption {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
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

  //- BaseInput резервирует строку hint снизу (reserve-hint-space), из-за чего
  //- его бокс выше кнопки. flex-start ставит верх кнопки на уровень поля —
  //- кнопка «Применить» не проваливается к низу резерв-строки.
  &__manual {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
  }

  &__manual-input {
    flex: 1 1 auto;
  }
}
</style>
