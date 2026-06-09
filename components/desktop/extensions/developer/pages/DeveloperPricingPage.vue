<template>
  <q-page padding>
    <div class="q-pa-md">
      <div class="text-h5 q-mb-md">Pricing</div>
      <q-banner class="bg-info text-white q-mb-md" rounded>
        Заглушка (Epic 9 story 9.3). Здесь будут карточки пакетов
        с текущей ставкой (asset RUB/час), кнопкой «Изменить» (POST
        /v1/admin/pricing) и графиком списаний за последние N тиков.
      </q-banner>
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle2">Текущие ставки</div>
          <q-list separator class="q-mt-md">
            <q-item>
              <q-item-section>
                <q-item-label>@voskhod/demoapp · default</q-item-label>
                <q-item-label caption>1.3889 RUB/h ≈ 1000 RUB/мес</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
// Заглушка для V1.
</script>
