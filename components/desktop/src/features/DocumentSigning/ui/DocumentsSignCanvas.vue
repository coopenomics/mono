<template lang="pug">
.documents-sign-canvas
  .signature-container(
    ref='around',
    :class='{ "signature-started": signatureStarted }'
  )
    p.signature-hint {{ hint }}
  .q-mt-md.q-gutter-sm.row.justify-end
    q-btn(flat, label='Очистить', @click='clear')
    q-btn(color='primary', label='Подписать', @click='submit')
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Classes } from '@coopenomics/sdk'
import { FailAlert } from 'src/shared/api'

withDefaults(
  defineProps<{
    hint?: string
  }>(),
  {
    hint: 'Оставьте собственноручную подпись в рамке',
  }
)

const emit = defineEmits<{
  signed: [signature: string]
}>()

const around = ref<HTMLElement | null>(null)
const signatureStarted = ref(false)
let canvasInst: Classes.Canvas | null = null

const attachStartHandler = () => {
  if (!canvasInst) return
  const cnv = canvasInst.canvas
  const handler = () => {
    signatureStarted.value = true
    cnv.removeEventListener('mousedown', handler)
    cnv.removeEventListener('touchstart', handler)
  }
  cnv.addEventListener('mousedown', handler)
  cnv.addEventListener('touchstart', handler)
}

const initCanvas = () => {
  setTimeout(() => {
    if (around.value) {
      canvasInst = new Classes.Canvas(around.value, {
        lineWidth: 5,
        strokeStyle:
          getComputedStyle(document.documentElement)
            .getPropertyValue('--q-primary')
            .trim() || '#1976d2',
      })
      attachStartHandler()
    }
  }, 200)
}

onMounted(() => {
  void nextTick(() => initCanvas())
})

onBeforeUnmount(() => {
  canvasInst?.destroy()
  canvasInst = null
})

const clear = () => {
  canvasInst?.clearCanvas()
  signatureStarted.value = false
  attachStartHandler()
}

const submit = () => {
  if (!canvasInst) {
    FailAlert('Пожалуйста, оставьте собственноручную подпись в окне')
    return
  }
  const sign = canvasInst.getSignature()
  const ctx = canvasInst.ctx
  const { width, height } = canvasInst.canvas
  const data = ctx.getImageData(0, 0, width, height).data
  const isEmpty = !data.some((channel) => channel !== 0)
  if (!sign || isEmpty) {
    FailAlert('Пожалуйста, оставьте собственноручную подпись в окне')
    return
  }
  emit('signed', sign)
}
</script>

<style scoped>
.signature-container {
  min-height: 300px;
  padding: 16px;
  border: 3px solid var(--q-primary);
  border-radius: 12px;
  box-shadow:
    0 0 8px var(--q-primary),
    0 0 16px var(--q-primary),
    inset 0 0 8px rgba(255, 255, 255, 0.1);
  background: transparent;
  position: relative;
  transition: all 0.3s ease;
}

.signature-container:hover {
  box-shadow:
    0 0 12px var(--q-primary),
    0 0 24px var(--q-primary),
    inset 0 0 12px rgba(255, 255, 255, 0.15);
}

.signature-hint {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  color: var(--q-primary);
  font-weight: 500;
  font-size: 14px;
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 4px 12px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
  z-index: 1;
  pointer-events: none;
}

.body--dark .signature-hint {
  background: rgba(0, 0, 0, 0.8);
  color: var(--q-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.signature-container.signature-started .signature-hint {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
  pointer-events: none;
  transition: all 0.5s ease-out;
}
</style>
