<template>
  <q-page padding>
    <div class="q-pa-md">
      <div class="text-h5 q-mb-md">Мои пакеты</div>
      <q-banner class="bg-info text-white q-mb-md" rounded>
        Стол разработчика, MVP-заглушка (Epic 9 story 9.3).
        Здесь будет таблица пакетов вашего кооператива из apps-catalog.
      </q-banner>
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle1">@voskhod/demoapp · 0.1.0</div>
          <div class="text-caption text-grey">remote · 1000 RUB/мес</div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
// Заглушка для V1 пилота Epic 9. Реальный запрос:
//   GET /v1/admin/packages?owner=<chairman.coopname>
// будет добавлен в story 9.3.b вместе с резолверами controller'а.
</script>
