<template>
  <div class="mp-barcode-scanner" :class="{ 'mp-barcode-scanner--active': state === 'scanning' }">
    <div class="mp-barcode-scanner__viewport">
      <div v-if="state === 'idle'" class="mp-barcode-scanner__overlay">
        <q-icon name="fa-solid fa-barcode" size="64px" color="grey-5" />
        <div class="text-body1 q-mt-md text-grey-7">Сканер готов</div>
        <q-btn unelevated color="primary" :label="startLabel" class="q-mt-md" @click="start" />
      </div>

      <div v-else-if="state === 'requesting'" class="mp-barcode-scanner__overlay">
        <q-spinner color="primary" size="48px" />
        <div class="text-body1 q-mt-md">Запрос доступа к камере…</div>
      </div>

      <div v-else-if="state === 'scanning'" class="mp-barcode-scanner__viewfinder">
        <div class="mp-barcode-scanner__corners" />
        <div class="mp-barcode-scanner__laser" />
        <div class="mp-barcode-scanner__hint">Поместите штрих-код в рамку</div>
      </div>

      <div v-else-if="state === 'success'" class="mp-barcode-scanner__overlay mp-barcode-scanner__flash">
        <q-icon name="fa-solid fa-circle-check" size="64px" color="positive" />
        <div class="text-h6 q-mt-md text-positive">{{ lastCode }}</div>
        <div class="text-caption text-grey-7 q-mt-xs">Visual feedback вместо звука «пик» (UX-DR26)</div>
        <q-btn unelevated color="primary" label="Сканировать ещё" class="q-mt-md" @click="start" />
      </div>

      <div v-else-if="state === 'error'" class="mp-barcode-scanner__overlay">
        <q-icon name="fa-solid fa-triangle-exclamation" size="64px" color="negative" />
        <div class="text-body1 q-mt-md text-negative">{{ errorMessage }}</div>
        <q-btn flat color="primary" label="Повторить" class="q-mt-md" @click="start" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'

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

defineExpose({ start, state, lastCode })
</script>

<style scoped lang="scss">
.mp-barcode-scanner {
  width: 100%;
  max-width: 420px;
  aspect-ratio: 4 / 3;
  background: #000;
  border-radius: 8px;
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    text-align: center;
    padding: var(--mp-space-lg);
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
  0%   { background: rgba(76, 175, 80, .4); }
  100% { background: transparent; }
}
</style>
