<template>
  <div>
    <div class="text-h5 q-mb-md">BarcodeScanner · Story 10.2.5 · UX-DR11</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Сканер штрих-кода через camera-API или USB-сканер. В витрине — mock:
      кнопка «Начать» → запрос камеры → viewfinder с лазером → визуальная вспышка
      (UX-DR26 заменяет звук «пик»). Используется на operator-столе ПВЗ.
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <div class="text-subtitle1 q-mb-sm">Успешное сканирование</div>
        <BarcodeScanner @scanned="onScanned" />
      </div>
      <div class="col-12 col-md-6">
        <div class="text-subtitle1 q-mb-sm">Ошибка камеры</div>
        <BarcodeScanner
          force-error="Доступ к камере запрещён"
          @error="onError"
        />
      </div>
    </div>

    <q-banner v-if="event" class="mp-event-banner q-mt-lg" rounded>
      Событие: <strong>{{ event }}</strong>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BarcodeScanner } from 'src/widgets/Marketplace/BarcodeScanner'

const event = ref('')
function onScanned(code: string) { event.value = `scanned: ${code}` }
function onError(msg: string) { event.value = `error: ${msg}` }
</script>
