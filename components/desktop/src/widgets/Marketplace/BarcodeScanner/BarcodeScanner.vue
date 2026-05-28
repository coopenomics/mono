<template>
  <div class="mp-barcode-scanner" :class="{ 'mp-barcode-scanner--active': state === 'scanning' }">
    <div class="mp-barcode-scanner__viewport">
      <div v-if="state === 'idle'" class="mp-barcode-scanner__overlay">
        <q-icon name="fa-solid fa-barcode" size="64px" class="mp-barcode-scanner__muted" />
        <div class="mp-barcode-scanner__caption">Сканер готов</div>
        <q-btn unelevated no-caps color="primary" :label="startLabel" class="mp-barcode-scanner__btn" @click="start" />
      </div>

      <div v-else-if="state === 'requesting'" class="mp-barcode-scanner__overlay">
        <q-spinner color="primary" size="48px" />
        <div class="mp-barcode-scanner__caption">Запрос доступа к камере…</div>
      </div>

      <div v-else-if="state === 'scanning'" class="mp-barcode-scanner__viewfinder">
        <div class="mp-barcode-scanner__corners" />
        <div class="mp-barcode-scanner__laser" />
        <div class="mp-barcode-scanner__hint">Поместите штрих-код в рамку</div>
      </div>

      <div v-else-if="state === 'success'" class="mp-barcode-scanner__overlay mp-barcode-scanner__flash">
        <q-icon name="fa-solid fa-circle-check" size="64px" color="positive" />
        <div class="mp-barcode-scanner__code">{{ lastCode }}</div>
        <div class="mp-barcode-scanner__caption mp-barcode-scanner__caption--small">
          Штрих-код считан
        </div>
        <q-btn unelevated no-caps color="primary" label="Сканировать ещё" class="mp-barcode-scanner__btn" @click="start" />
      </div>

      <div v-else-if="state === 'error'" class="mp-barcode-scanner__overlay">
        <q-icon name="fa-solid fa-triangle-exclamation" size="64px" color="negative" />
        <div class="mp-barcode-scanner__caption mp-barcode-scanner__caption--error">{{ errorMessage }}</div>
        <q-btn flat no-caps color="primary" label="Повторить" class="mp-barcode-scanner__btn" @click="start" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, type PropType } from 'vue'

export type ScannerState = 'idle' | 'requesting' | 'scanning' | 'success' | 'error'

const props = defineProps({
  startLabel: { type: String, default: 'Начать сканирование' },
  // mock-режим — в реальной реализации тут будет camera-API / USB-сканер.
  mockCodes: { type: Array as PropType<string[]>, default: () => ['1234567890128', '4012345678901', '5901234123457'] },
  // для демо-симуляции ошибок
  forceError: { type: String, default: '' },
})

const emit = defineEmits<{
  (e: 'scanned', code: string): void
  (e: 'error', message: string): void
}>()

const state = ref<ScannerState>('idle')
const lastCode = ref('')
const errorMessage = ref('')

let timer: ReturnType<typeof setTimeout> | null = null

function start() {
  if (timer) clearTimeout(timer)
  errorMessage.value = ''
  state.value = 'requesting'

  timer = setTimeout(() => {
    if (props.forceError) {
      errorMessage.value = props.forceError
      state.value = 'error'
      emit('error', props.forceError)
      return
    }
    state.value = 'scanning'

    timer = setTimeout(() => {
      const code = props.mockCodes[Math.floor(Math.random() * props.mockCodes.length)] ?? '0000000000000'
      lastCode.value = code
      state.value = 'success'
      emit('scanned', code)
    }, 1500)
  }, 600)
}

// Чистим pending-таймер при unmount, чтобы scanned/error не эмитился на
// уже размонтированный компонент (TakeoverDialog закрывают раньше, чем
// сработает 1500 ms таймер «сканирования»).
onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
})

defineExpose({ start, state, lastCode })
</script>

<style scoped lang="scss">
.mp-barcode-scanner {
  width: 100%;
  max-width: 420px;
  aspect-ratio: 4 / 3;
  background: #000;
  border-radius: var(--mp-radius-md);
  overflow: hidden;
  position: relative;

  &__viewport {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, .35); // явный полупрозрачный bg — работает и на dark и на light
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    text-align: center;
    padding: var(--mp-space-lg);
    gap: var(--mp-space-sm);
  }

  &__muted { color: rgba(255, 255, 255, .55); }

  &__caption {
    color: rgba(255, 255, 255, .85);
    font-size: 14px;

    &--small { font-size: 12px; color: rgba(255, 255, 255, .65); }
    &--error { color: var(--q-negative); }
  }

  &__code {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: .02em;
    color: var(--q-positive);
  }

  &__btn {
    border-radius: var(--mp-radius-sm);
    margin-top: var(--mp-space-sm);
    box-shadow: none !important;
  }

  &__flash {
    animation: mp-flash .4s ease-out;
  }

  &__viewfinder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  &__corners {
    width: 70%;
    height: 50%;
    border: 2px solid rgba(255, 255, 255, .85);
    border-radius: 6px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, .35);
  }

  &__laser {
    position: absolute;
    top: 50%;
    left: 16%;
    right: 16%;
    height: 2px;
    background: #ff3344;
    box-shadow: 0 0 12px #ff3344;
    animation: mp-laser 1.6s ease-in-out infinite;
  }

  &__hint {
    position: absolute;
    bottom: var(--mp-space-md);
    width: 100%;
    text-align: center;
    font-size: 14px;
    color: rgba(255, 255, 255, .85);
  }
}

@keyframes mp-laser {
  0%, 100% { transform: translateY(-60px); }
  50%      { transform: translateY( 60px); }
}

@keyframes mp-flash {
  0%   { background: rgba(76, 175, 80, .55); }
  100% { background: rgba(0, 0, 0, .35); }
}
</style>
