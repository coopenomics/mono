<template lang="pug">
  div
    q-table(
      v-if="coops"
      ref="tableRef" v-model:expanded="expanded"
      flat
      :rows="coops"
      :columns="columns"
      :table-colspan="9"
      row-key="coopname"
      :pagination="pagination"
      virtual-scroll
      :virtual-scroll-item-size="48"
      :rows-per-page-options="[10]"
      :loading="onLoading"
      :no-data-label="'Нет кооперативов'"
    ).full-height
      template(#top)


      template(#header="props")

        q-tr(:props="props")
          q-th(auto-width)

          q-th(
            v-for="col in props.cols"
            :key="col.name"
            :props="props"
          ) {{ col.label }}

      template(#body="props")
        q-tr(:key="`m_${props.row.coopname}`" :props="props")
          q-td(auto-width)
            q-btn(size="sm" color="primary" round dense :icon="props.expand ? 'remove' : 'add'" @click="props.expand = !props.expand")
          q-td {{ props.row.coopname }}
          q-td {{ props.row.announce }}

          q-td
            q-badge(v-if="props.row.status === 'active'" color="teal") активен
            q-badge(v-else-if="props.row.status === 'pending'" color="orange") на рассмотрении
            q-badge(v-else-if="props.row.status === 'blocked'" color="red") заблокирован
            q-badge(v-else color="grey") {{ props.row.status }}

          q-td
            template(v-if="hostingStatus(props.row)")
              q-badge(:color="instanceStatusColor(hostingStatus(props.row))") {{ instanceStatusLabel(hostingStatus(props.row)) }}
              span.text-caption.q-ml-xs(v-if="installationProgress(props.row) != null") {{ installationProgress(props.row) }}%
            span.text-grey(v-else-if="props.row.has_provider_data") —
            span.text-grey(v-else) нет подписки

          q-td
            span(v-if="monthlyCost(props.row) > 0") {{ formatMoney(monthlyCost(props.row)) }} ₽/мес
            span.text-grey(v-else) —

          q-td {{ props.row.created_at ? moment(props.row.created_at).format('DD.MM.YY HH:mm:ss') : '—' }}

          q-td
            q-btn-dropdown( label="действия" flat size="sm")
              q-list
                q-item(v-if="props.row.status !== 'active'" clickable v-close-popup @click="activate(props.row.coopname)")
                  q-item-section
                    q-item-label Активировать
                q-item(v-if="props.row.status !== 'blocked'" clickable v-close-popup @click="block(props.row.coopname)")
                  q-item-section
                    q-item-label Заблокировать

        q-tr(v-show="props.expand" :key="`e_${props.row.coopname}`" :props="props" class="q-virtual-scroll--with-prev")
          q-td(colspan="100%")
            div.q-pa-sm
              div.text-subtitle2.q-mb-sm Подписки у провайдера

              q-markup-table(v-if="props.row.subscriptions && props.row.subscriptions.length" flat dense bordered)
                thead
                  tr
                    th.text-left Тип
                    th.text-left Статус подписки
                    th.text-left Стоимость
                    th.text-left Действует до
                    th.text-left Инстанс
                    th.text-left Прогресс
                tbody
                  tr(v-for="sub in props.row.subscriptions" :key="sub.id")
                    td.text-left
                      | {{ sub.subscription_type_name }}
                      q-badge.q-ml-xs(v-if="sub.is_trial" color="purple" outline) триал
                    td.text-left
                      q-badge(:color="subscriptionStatusColor(sub.status)") {{ subscriptionStatusLabel(sub.status) }}
                    td.text-left {{ formatMoney(sub.price) }} ₽ / {{ sub.period_days }} дн
                    td.text-left {{ sub.expires_at ? moment(sub.expires_at).format('DD.MM.YY') : '—' }}
                    td.text-left
                      q-badge(v-if="sub.instance_status" :color="instanceStatusColor(sub.instance_status)") {{ instanceStatusLabel(sub.instance_status) }}
                      span.text-grey(v-else) —
                    td.text-left {{ sub.installation_progress != null ? sub.installation_progress + '%' : '—' }}

              div.text-grey.q-pa-sm(v-else) У кооператива нет подписок у провайдера.

  </template>
  <script setup lang="ts">
  import { useLoadCooperatives } from 'src/features/Union/LoadCooperatives';
  const {loadCooperatives} = useLoadCooperatives()
  import { useUnionStore } from 'src/entities/Union/model';
  import type { ICooperativeRegistryItem } from 'src/entities/Union/model';
  import { computed, ref } from 'vue';
  import moment from 'src/shared/lib/utils/dates/moment'
  import { useActivateCooperative } from 'src/features/Union/ActivateCooperative';
  import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
  import { useBlockCooperative } from 'src/features/Union/BlockCooperative';
  const union = useUnionStore()

  type ICooperativeSubscription = ICooperativeRegistryItem['subscriptions'][number]

  const coops = computed(() => union.coops)

  const onLoading = ref(false)

  const load = async () => {
    onLoading.value = true
    try {
      await loadCooperatives()
    } catch (e: any) {
      FailAlert(e)
    } finally {
      onLoading.value = false
    }
  }

  load()

  // Хостинг-подписка кооператива (если есть инстанс) — для сводного статуса в строке.
  const hostingSubscription = (row: ICooperativeRegistryItem): ICooperativeSubscription | undefined =>
    row.subscriptions?.find((s) => !!s.instance_status)

  const hostingStatus = (row: ICooperativeRegistryItem): string | null =>
    hostingSubscription(row)?.instance_status ?? null

  const installationProgress = (row: ICooperativeRegistryItem): number | null => {
    const p = hostingSubscription(row)?.installation_progress
    return typeof p === 'number' ? p : null
  }

  // Сумма ежемесячной стоимости всех подписок кооператива.
  const monthlyCost = (row: ICooperativeRegistryItem): number =>
    (row.subscriptions ?? []).reduce((sum, s) => sum + Number(s.price ?? 0), 0)

  const formatMoney = (value: number): string =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)

  const instanceStatusColor = (status: string | null): string => {
    switch (status) {
      case 'active': return 'teal'
      case 'install':
      case 'rent':
      case 'pending': return 'orange'
      case 'error':
      case 'blocked':
      case 'requires_manual_review': return 'red'
      default: return 'grey'
    }
  }

  const instanceStatusLabel = (status: string | null): string => {
    switch (status) {
      case 'active': return 'активен'
      case 'install': return 'установка'
      case 'rent': return 'аренда'
      case 'pending': return 'ожидание'
      case 'error': return 'ошибка'
      case 'blocked': return 'заблокирован'
      case 'requires_manual_review': return 'нужна проверка'
      default: return status ?? '—'
    }
  }

  const subscriptionStatusColor = (status: string): string => {
    switch (status) {
      case 'ACTIVE': return 'teal'
      case 'TRIAL': return 'blue'
      case 'EXPIRED': return 'orange'
      case 'CANCELLED': return 'red'
      default: return 'grey'
    }
  }

  const subscriptionStatusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE': return 'активна'
      case 'TRIAL': return 'триал'
      case 'EXPIRED': return 'истекла'
      case 'CANCELLED': return 'отменена'
      default: return status
    }
  }

  const activate = async (coopname: string) => {
    const {activateCooperative} = useActivateCooperative()

    try {
      await activateCooperative(coopname)
      await load()
      SuccessAlert('Кооператив активирован')
    } catch(e: any) {
      FailAlert(e)
    }
  }

  const block = async (coopname: string) => {
    const {blockCooperative} = useBlockCooperative()

    try {
      await blockCooperative(coopname)
      await load()
      SuccessAlert('Кооператив заблокирован')
    } catch(e: any) {
      FailAlert(e)
    }
  }

  const columns = [
    { name: 'coopname', align: 'left', label: 'Аккаунт', field: 'coopname', sortable: true },
    { name: 'announce', align: 'left', label: 'Сайт', field: 'announce', sortable: false },
    { name: 'status', align: 'left', label: 'Статус в реестре', field: 'status', sortable: true },
    { name: 'hosting', align: 'left', label: 'Хостинг', field: 'hosting', sortable: false },
    { name: 'cost', align: 'left', label: 'Стоимость', field: 'cost', sortable: false },
    {
      name: 'created_at',
      align: 'left',
      label: 'Дата заявки',
      field: 'created_at',
      sortable: true,
    },
    { name: 'actions', align: 'center', label: '', field: 'actions', sortable: false },
  ] as any

  const expanded = ref([])
  const tableRef = ref(null)
  const pagination = ref({ rowsPerPage: 0 })


  </script>
