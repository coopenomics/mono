<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Настройки маркетплейса
    .hero-subtitle Управление правилами и доступом к витрине

  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Тип ведущих заявок

    q-card-section
      q-option-group(
        v-model="settings.lead_request_policy"
        :options="leadOptions"
        type="radio"
        color="primary"
      )

  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Доступ к публикации

    q-card-section
      q-option-group(
        v-model="settings.publish_access_policy"
        :options="publishOptions"
        type="radio"
        color="primary"
      )

    q-card-section(v-if="settings.publish_access_policy === 'whitelist'")
      .text-subtitle2.q-mb-sm Белый список пайщиков
      .row.q-gutter-sm
        .col-8
          q-input(v-model="newWhitelistUser" label="Username пайщика" dense outlined)
        .col-4
          q-btn(color="primary" label="Добавить" no-caps @click="addToWhitelist" :disable="!newWhitelistUser")
      q-chip(
        v-for="user in settings.publish_whitelist"
        :key="user"
        removable
        @remove="removeFromWhitelist(user)"
        color="blue-2"
        text-color="blue-9"
      ).q-mt-sm {{ user }}

  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Модерация и циклы

    q-card-section
      q-toggle(v-model="settings.moderation_required" label="Требуется модерация карточек")
      q-toggle(v-model="settings.cycles_enabled" label="Разрешить циклические поставки")
      q-input.q-mt-sm(
        v-if="settings.cycles_enabled"
        v-model.number="settings.max_cycle_days"
        label="Макс. срок цикла (дней)"
        type="number"
        dense
        outlined
        style="max-width: 200px"
      )

  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Доставка

    q-card-section
      q-toggle(v-model="settings.internal_delivery_enabled" label="Внутренняя доставка (между КУ)")
      q-toggle(v-model="settings.external_delivery_enabled" label="Внешняя доставка (СДЭК и пр.)")

  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Ограничения цен

    q-card-section
      .row.q-gutter-md
        .col-6
          q-input(v-model="settings.min_unit_cost" label="Мин. цена за единицу" dense outlined)
        .col-6
          q-input(v-model="settings.max_unit_cost" label="Макс. цена за единицу" dense outlined)

  q-card.q-mt-md(flat)
    q-card-actions
      q-btn(color="primary" label="Сохранить настройки" icon="save" no-caps @click="save" :loading="saving")
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { client } from 'src/shared/api/client'
import { Notify } from 'quasar'

const saving = ref(false)
const newWhitelistUser = ref('')

const settings = reactive({
  lead_request_policy: 'both',
  publish_access_policy: 'all_members',
  publish_whitelist: [] as string[],
  moderation_required: true,
  cycles_enabled: true,
  max_cycle_days: 30,
  external_delivery_enabled: true,
  internal_delivery_enabled: true,
  min_unit_cost: '',
  max_unit_cost: '',
})

const leadOptions = [
  { label: 'Только предложения (обычный маркетплейс)', value: 'offers_only' },
  { label: 'Только заказы (закупка по спросу)', value: 'orders_only' },
  { label: 'И предложения, и заказы', value: 'both' },
]

const publishOptions = [
  { label: 'Все пайщики', value: 'all_members' },
  { label: 'Только белый список', value: 'whitelist' },
  { label: 'Только председатель / члены совета', value: 'council_only' },
]

onMounted(async () => {
  try {
    const { getMarketplaceSettings } = await client.Query({
      getMarketplaceSettings: {
        lead_request_policy: true,
        publish_access_policy: true,
        publish_whitelist: true,
        moderation_required: true,
        cycles_enabled: true,
        max_cycle_days: true,
        external_delivery_enabled: true,
        internal_delivery_enabled: true,
        min_unit_cost: true,
        max_unit_cost: true,
      },
    })
    if (getMarketplaceSettings) {
      Object.assign(settings, getMarketplaceSettings)
    }
  } catch { /* first load — defaults */ }
})

function addToWhitelist() {
  if (newWhitelistUser.value && !settings.publish_whitelist.includes(newWhitelistUser.value)) {
    settings.publish_whitelist.push(newWhitelistUser.value)
    newWhitelistUser.value = ''
  }
}

function removeFromWhitelist(user: string) {
  settings.publish_whitelist = settings.publish_whitelist.filter(u => u !== user)
}

async function save() {
  saving.value = true
  try {
    await client.Mutation({
      updateMarketplaceSettings: [{
        data: {
          lead_request_policy: settings.lead_request_policy as any,
          publish_access_policy: settings.publish_access_policy as any,
          publish_whitelist: settings.publish_whitelist,
          moderation_required: settings.moderation_required,
          cycles_enabled: settings.cycles_enabled,
          max_cycle_days: settings.max_cycle_days,
          external_delivery_enabled: settings.external_delivery_enabled,
          internal_delivery_enabled: settings.internal_delivery_enabled,
          min_unit_cost: settings.min_unit_cost || undefined,
          max_unit_cost: settings.max_unit_cost || undefined,
        },
      }, {
        lead_request_policy: true,
      }],
    })
    Notify.create({ type: 'positive', message: 'Настройки сохранены' })
  } catch (e: any) {
    Notify.create({ type: 'negative', message: e?.message || 'Ошибка сохранения' })
  }
  saving.value = false
}
</script>
