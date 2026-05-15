<template>
  <div>
    <div class="text-h5 q-mb-md">BarcodeDisplay · Story 10.2.6 · UX-DR12</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Визуальный рендер штрих-кода для печати на ТТН/упаковке.
      В функциональной реализации (Эпик 6) подключается jsbarcode для печатной
      пригодности; в витрине — псевдо-генерация для согласования макета.
    </div>

    <q-input v-model="code" outlined dense label="Код" class="q-mb-md" style="max-width: 320px" />

    <div class="row q-col-gutter-lg items-center">
      <div class="column items-center">
        <div class="text-caption q-mb-sm">size=sm</div>
        <BarcodeDisplay :code="code" size="sm" />
      </div>
      <div class="column items-center">
        <div class="text-caption q-mb-sm">size=md</div>
        <BarcodeDisplay :code="code" size="md" />
      </div>
      <div class="column items-center">
        <div class="text-caption q-mb-sm">size=lg</div>
        <BarcodeDisplay :code="code" size="lg" />
      </div>
      <div class="column items-center">
        <div class="text-caption q-mb-sm">без подписи</div>
        <BarcodeDisplay :code="code" size="md" :show-text="false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay'

const code = ref('MP-1234-A56-B78')
</script>
