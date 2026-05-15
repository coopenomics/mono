<template>
  <div>
    <div class="text-h5 q-mb-md">KUMapWithList · Story 10.2.13 · Эпик 2 Story 2.3</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Карта ПВЗ с синхронным выбором пин/список. Существующий виджет
      <code>src/widgets/KUMapWithList</code> подключён к Yandex Maps API.
      Здесь — превью layout-а и состояний (loading, no-api-key, geocode-warnings).
      Реальная карта работает на странице <code>/market-pvz/list</code>.
    </div>

    <q-banner class="mp-event-banner q-mb-md" rounded>
      <template #avatar>
        <q-icon name="fa-solid fa-circle-info" color="primary" />
      </template>
      Витрина не подключает Yandex Maps SDK — рендерится только список с
      идентичной разметкой; стилевая часть карты тестируется на реальной странице.
    </q-banner>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <div class="text-subtitle1 q-mb-sm">Список ПВЗ (layout идентичен виджету)</div>
        <q-list bordered separator class="rounded-borders">
          <q-item
            v-for="pvz in pvzList"
            :key="pvz.coreBraname"
            clickable
            :active="selected === pvz.coreBraname"
            active-class="bg-primary text-white"
            @click="selected = pvz.coreBraname"
          >
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ pvz.coreBraname }}</q-item-label>
              <q-item-label caption>{{ pvz.addressFull }}</q-item-label>
              <q-item-label v-if="pvz.geocodeStatus !== 'OK'" caption :class="pvz.geocodeStatus === 'PENDING' ? 'text-warning' : 'text-negative'">
                {{ pvz.geocodeStatus === 'PENDING' ? 'Геокодирование выполняется…' : 'Ошибка геокодирования' }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <div class="col-12 col-md-6">
        <div class="text-subtitle1 q-mb-sm">Превью места карты</div>
        <q-card flat bordered class="mp-ku-map-placeholder">
          <div class="row items-center justify-center column">
            <q-icon name="fa-solid fa-map-location-dot" size="64px" color="grey-5" />
            <div class="text-body2 q-mt-md text-grey-7">Yandex Maps (виджет)</div>
            <div class="text-caption text-grey-6">Выбран: {{ selected || '—' }}</div>
          </div>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const selected = ref<string>('')

const pvzList = [
  { coreBraname: 'pvz-molodezhnaya',  addressFull: 'г. Восход, ул. Молодёжная, 12', geocodeStatus: 'OK' },
  { coreBraname: 'pvz-gagarina',      addressFull: 'г. Восход, ул. Гагарина, 5',    geocodeStatus: 'OK' },
  { coreBraname: 'pvz-pobedy',        addressFull: 'г. Восход, ул. Победы, 8',      geocodeStatus: 'PENDING' },
  { coreBraname: 'pvz-bibliotechnaya', addressFull: 'г. Восход, ул. Библиотечная, 1', geocodeStatus: 'FAILED' },
]
</script>

<style scoped lang="scss">
.mp-ku-map-placeholder {
  height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, .03);
}
</style>
