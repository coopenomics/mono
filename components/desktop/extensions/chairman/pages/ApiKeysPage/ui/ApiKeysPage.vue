<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title API Ключи
    .hero-subtitle Управление ключами доступа к API кооператива

  q-card.q-mt-md(flat)
    q-card-section
      .row.items-center
        .text-h6.col Ключи доступа
        q-btn(color='primary' icon='add' label='Создать ключ' no-caps @click='showCreate = true')

    q-separator

    q-card-section
      q-table(
        :rows='keys'
        :columns='columns'
        row-key='id'
        flat
        :loading='loading'
      )
        template(#body-cell-status='props')
          q-td(:props='props')
            q-chip(
              :color='props.row.is_active ? "positive" : "negative"'
              text-color='white'
              dense
            ) {{ props.row.is_active ? 'Активен' : 'Отозван' }}

        template(#body-cell-actions='props')
          q-td(:props='props')
            q-btn(
              v-if='props.row.is_active'
              flat
              dense
              icon='block'
              color='negative'
              @click='revoke(props.row.id)'
            )
              q-tooltip Отозвать ключ

      .text-center.text-grey-5.q-pa-lg(v-if='keys.length === 0 && !loading')
        q-icon(name='vpn_key' size='48px')
        .q-mt-sm Нет API ключей

  //- Диалог создания
  q-dialog(v-model='showCreate')
    q-card(style='min-width: 450px')
      q-card-section
        .text-h6 Новый API ключ
      q-card-section
        q-input(v-model='newName' label='Название ключа' autofocus dense)
        q-input.q-mt-sm(
          v-model.number='newExpiresInDays'
          label='Срок действия (дней, пусто = бессрочно)'
          type='number'
          dense
        )
      q-card-actions(align='right')
        q-btn(flat label='Отмена' @click='showCreate = false')
        q-btn(flat label='Создать' color='primary' @click='create' :loading='creating')

  //- Диалог с созданным ключом
  q-dialog(v-model='showCreatedKey' persistent)
    q-card(style='min-width: 500px')
      q-card-section
        .text-h6 🔑 Ключ создан
        .text-body2.text-negative.q-mt-sm Скопируйте ключ сейчас — он больше не будет показан!
      q-card-section
        q-input(
          :modelValue='createdKey'
          readonly
          outlined
          dense
          type='textarea'
          rows='2'
        )
          template(#append)
            q-btn(flat dense icon='content_copy' @click='copyKey')
      q-card-actions(align='right')
        q-btn(flat label='Закрыть' color='primary' @click='showCreatedKey = false')
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { client } from 'src/shared/api/client'
import { copyToClipboard, Notify } from 'quasar'

const keys = ref<any[]>([])
const loading = ref(false)
const showCreate = ref(false)
const creating = ref(false)
const newName = ref('')
const newExpiresInDays = ref<number | undefined>(undefined)
const showCreatedKey = ref(false)
const createdKey = ref('')

const columns = [
  { name: 'name', label: 'Название', field: 'name', align: 'left' as const },
  { name: 'key_prefix', label: 'Префикс', field: 'key_prefix', align: 'left' as const },
  { name: 'created_by', label: 'Создал', field: 'created_by', align: 'left' as const },
  { name: 'status', label: 'Статус', field: 'is_active', align: 'center' as const },
  { name: 'expires_at', label: 'Истекает', field: (r: any) => r.expires_at ? new Date(r.expires_at).toLocaleDateString('ru') : '∞', align: 'center' as const },
  { name: 'last_used_at', label: 'Последнее использование', field: (r: any) => r.last_used_at ? new Date(r.last_used_at).toLocaleString('ru') : '—', align: 'center' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]

onMounted(() => loadKeys())

async function loadKeys() {
  loading.value = true
  try {
    const { getApiKeys } = await client.Query({
      getApiKeys: {
        id: true, name: true, key_prefix: true, created_by: true,
        allowed_operations: true, is_active: true,
        expires_at: true, last_used_at: true, created_at: true,
      },
    })
    keys.value = getApiKeys || []
  } catch {}
  loading.value = false
}

async function create() {
  if (!newName.value) return
  creating.value = true
  try {
    const { createApiKey } = await client.Mutation({
      createApiKey: [{
        data: {
          name: newName.value,
          expiresInDays: newExpiresInDays.value || undefined,
        },
      }, { id: true, key: true, name: true }],
    })
    createdKey.value = createApiKey.key
    showCreate.value = false
    showCreatedKey.value = true
    newName.value = ''
    newExpiresInDays.value = undefined
    await loadKeys()
  } catch (e: any) {
    Notify.create({ type: 'negative', message: e?.message || 'Ошибка' })
  }
  creating.value = false
}

async function revoke(id: string) {
  try {
    await client.Mutation({ revokeApiKey: [{ id }, true] })
    Notify.create({ type: 'info', message: 'Ключ отозван' })
    await loadKeys()
  } catch {}
}

function copyKey() {
  copyToClipboard(createdKey.value)
  Notify.create({ type: 'positive', message: 'Ключ скопирован' })
}
</script>
