<template lang="pug">
  div
    q-table(
      v-if="coops"
      ref="tableRef" v-model:expanded="expanded"
      flat
      :rows="coops"
      :columns="columns"
      :table-colspan="9"
      row-key="username"
      :pagination="pagination"
      virtual-scroll
      :virtual-scroll-item-size="48"
      :rows-per-page-options="[10]"
      :loading="onLoading"
      :no-data-label="$t('union.unionPageListOfCooperatives.noDataLabel')"
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
        q-tr(:key="`m_${props.row.username}`" :props="props")
          q-td(auto-width)
            q-btn(size="sm" color="primary" round dense :icon="props.expand ? 'remove' : 'add'" @click="props.expand = !props.expand")
          q-td {{ props.row.username }}
          q-td {{ props.row.announce }}

          q-td
            q-badge(v-if="props.row.status === 'active'" color="teal") {{ $t('union.unionPageListOfCooperatives.statusActive') }}
            q-badge(v-if="props.row.status === 'pending'" color="orange") {{ $t('union.unionPageListOfCooperatives.statusPending') }}
            q-badge(v-if="props.row.status === 'blocked'" color="red") {{ $t('union.unionPageListOfCooperatives.statusBlocked') }}

          q-td {{ moment(props.row.created_at).format('DD.MM.YY HH:mm:ss') }}

          q-td
            q-btn-dropdown( :label="$t('union.unionPageListOfCooperatives.actionsLabel')" flat size="sm")
              q-list
                q-item(v-if="props.row.status !== 'active'" clickable v-close-popup @click="activate(props.row.username)")
                  q-item-section
                    q-item-label {{ $t('union.unionPageListOfCooperatives.activateAction') }}
                q-item(v-if="props.row.status !== 'blocked'" clickable v-close-popup @click="block(props.row.username)")
                  q-item-section
                    q-item-label {{ $t('union.unionPageListOfCooperatives.blockAction') }}
                //- q-item(clickable v-close-popup @click="deleteCoop(props.row.username)")
                //-   q-item-section
                //-     q-item-label Удалить

        q-tr(v-show="props.expand" :key="`e_${props.row.username}`" :props="props" class="q-virtual-scroll--with-prev")
          q-td(colspan="100%")
            slot(:expand="props.expand" :receiver="props.row.username")
            ListOfDocumentsWidget(
              :username="props.row.username"
              :filter="{data: getDataFilter(props.row.document.hash)}"
              :expand="true"
              :documentType="'newsubmitted'"
            )

  </template>
  <script setup lang="ts">
  import { useLoadCooperatives } from 'src/features/Union/LoadCooperatives';
import { t } from 'src/shared/i18n';
  const {loadCooperatives} = useLoadCooperatives()
  import { useUnionStore } from 'src/entities/Union/model';
  import { computed, ref } from 'vue';
  import moment from 'src/shared/lib/utils/dates/moment'
  import { useActivateCooperative } from 'src/features/Union/ActivateCooperative';
  import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
  import { useBlockCooperative } from 'src/features/Union/BlockCooperative';
  const union = useUnionStore()

  import { ListOfDocumentsWidget } from 'src/widgets/Cooperative/Documents/ListOfDocuments';
  const getDataFilter = (hash: string) => {
    return {
      document: {
        hash: hash.toUpperCase()
      }
    }
  }

  const coops = computed(() => union.coops)

  loadCooperatives()

  const activate = async (coopname: string) => {
    const {activateCooperative} = useActivateCooperative()

    try {
      await activateCooperative(coopname)
      loadCooperatives()
      SuccessAlert(t('union.unionPageListOfCooperatives.activateSuccess'))
    } catch(e: any) {
      FailAlert(e)
    }
  }

  const block = async (coopname: string) => {
    const {blockCooperative} = useBlockCooperative()

    try {
      await blockCooperative(coopname)
      loadCooperatives()
      SuccessAlert(t('union.unionPageListOfCooperatives.blockSuccess'))
    } catch(e: any) {
      FailAlert(e)
    }
  }


  const onLoading = ref(false)

  const columns = [
    { name: 'username', align: 'left', label: t('union.unionPageListOfCooperatives.column.username'), field: 'username', sortable: true },
    { name: 'announce', align: 'left', label: t('union.unionPageListOfCooperatives.column.announce'), field: 'announce', sortable: false },

    { name: 'status', align: 'left', label: t('union.unionPageListOfCooperatives.column.status'), field: 'status', sortable: true },
    {
      name: 'created_at',
      align: 'left',
      label: t('union.unionPageListOfCooperatives.column.createdAt'),
      field: 'created_at',
      sortable: true,
    },
    { name: 'actions', align: 'center', label: '', field: 'actions', sortable: false },
  ] as any

  const expanded = ref([])
  const tableRef = ref(null)
  const pagination = ref({ rowsPerPage: 0 })


  </script>
