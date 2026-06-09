<template>
  <q-page padding>
    <div class="q-pa-md">
      <BaseBanner variant="info" class="q-mb-md">
        Здесь появится список кооперативов-подписчиков ваших пакетов:
        статус подписки, биллинг-период и сумма списания. Данные придут
        из каталога приложений после подключения отчётов по подпискам.
      </BaseBanner>
      <EmptyState
        title="Отчёт по подписчикам пока недоступен"
        body="Каталог приложений ещё не отдаёт список подписчиков по пакетам разработчика."
      >
        <template #icon>
          <q-icon name="group" size="28px" />
        </template>
      </EmptyState>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { BaseBanner, EmptyState } from 'src/shared/ui/base';
</script>
