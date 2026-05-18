<template>
  <q-page class="mp-role-admin q-pa-md">
    <div class="text-h5 q-mb-md">Экосистема кооперативов</div>

    <q-card class="mp-card q-mb-md">
      <q-card-section>
        <div class="text-subtitle1">Текущий кооператив</div>
        <div class="text-body2 text-grey-7 q-mt-xs">
          Кооператив <strong>{{ coopname || '—' }}</strong> установил расширение
          «Стол заказов». Информация о других кооперативах с marketplace будет
          подтянута платформенным реестром экосистемы (NFR-Sc2 / AR18).
        </div>
      </q-card-section>
    </q-card>

    <q-card class="mp-card">
      <q-card-section>
        <div class="text-subtitle1">Другие кооперативы с расширением «Стол заказов»</div>
        <div class="row items-center q-pa-md text-grey-7 q-gutter-sm">
          <q-icon name="info" size="20px" />
          <div class="text-body2">
            Список и межкооперативная торговля доступны во второй фазе. На MVP
            раздел работает в режиме «только просмотр» и отображается пустым,
            пока платформенный <code>ecosystem_registry</code> не подключён.
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));
</script>
