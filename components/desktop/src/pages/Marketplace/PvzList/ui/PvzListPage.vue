<template lang="pug">
q-page.q-pa-md(padding)
  .row.items-center.q-mb-md
    .text-h5 ПВЗ Стола заказов
    q-space
    q-btn(
      v-if="isAdmin"
      icon="refresh"
      label="Обновить"
      flat
      dense
      @click="reload"
    )
  KUMapWithList(
    :items="store.details"
    :loading="store.isLoading"
    :selected-braname="selectedBraname"
    aria-label="Список и карта ПВЗ кооператива"
    @select="onSelect"
  )
    template(#cardAction="{ pvz }")
      .column.items-end.q-gutter-xs(v-if="isAdmin")
        q-badge(:color="pvz.status === 'ACTIVE' ? 'positive' : 'grey'") {{ pvz.status === 'ACTIVE' ? 'Активен' : 'Деактивирован' }}
        q-btn(size="sm" flat dense icon="edit" label="Изменить" @click.stop="editPvz(pvz)")
        q-btn(
          v-if="pvz.geocodeStatus !== 'OK'"
          size="sm"
          flat
          dense
          color="warning"
          icon="my_location"
          label="Геокодинг"
          @click.stop="retryGeocode(pvz)"
        )
        q-btn(
          v-if="pvz.status === 'ACTIVE'"
          size="sm"
          flat
          dense
          color="negative"
          icon="block"
          label="Деактивировать"
          @click.stop="setStatus(pvz, 'INACTIVE')"
        )
        q-btn(
          v-else
          size="sm"
          flat
          dense
          color="positive"
          icon="check_circle"
          label="Активировать"
          @click.stop="setStatus(pvz, 'ACTIVE')"
        )

  MarketplaceDetailKUDialog(
    v-if="editing"
    v-model="dialogOpen"
    :coopname="coopname"
    :core-braname="editing.coreBraname"
    :existing="editing"
    @saved="onSaved"
  )
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useSessionStore } from 'src/entities/Session'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import type { IMarketplaceKUDetails } from 'src/entities/MarketplaceKUDetails'
import { KUMapWithList } from 'src/widgets/KUMapWithList'
import { MarketplaceDetailKUDialog } from 'src/features/MarketplaceDetailKU'

const route = useRoute()
const session = useSessionStore()
const store = useMarketplaceKUDetailsStore()
const { details } = storeToRefs(store)

const coopname = computed(() => String(route.params.coopname ?? ''))
const isAdmin = computed(() => session.isChairman ?? false)

const selectedBraname = ref<string | null>(null)
const editing = ref<IMarketplaceKUDetails | null>(null)
const dialogOpen = ref(false)

async function reload() {
  await store.load({ coopname: coopname.value, onlyActive: !isAdmin.value })
}

function onSelect(pvz: IMarketplaceKUDetails) {
  selectedBraname.value = pvz.coreBraname
}

function editPvz(pvz: IMarketplaceKUDetails) {
  editing.value = pvz
  dialogOpen.value = true
}

function onSaved(_pvz: IMarketplaceKUDetails) {
  void reload()
}

async function setStatus(pvz: IMarketplaceKUDetails, status: 'ACTIVE' | 'INACTIVE') {
  await store.setStatus({ coopname: coopname.value, coreBraname: pvz.coreBraname, status })
}

async function retryGeocode(pvz: IMarketplaceKUDetails) {
  await store.retryGeocode(coopname.value, pvz.coreBraname)
}

onMounted(() => {
  void reload()
})

// Используется для подавления "unused" на details — фактический driver UI.
const _unused = details
</script>
