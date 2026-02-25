<template lang="pug">
q-dialog(v-model='isOpen' persistent)
  q-card(style='width: 550px; max-width: 90vw')
    q-card-section
      .row.items-center
        q-icon(name='share' size='24px' color='primary')
        .text-h6.q-ml-sm Поделиться страницей
        q-space
        q-btn(flat round dense icon='close' @click='close')

    q-separator

    q-tabs(v-model='tab' dense class='text-primary')
      q-tab(name='create' label='Создать ссылку')
      q-tab(name='active' label='Активные ссылки')

    q-tab-panels(v-model='tab')
      q-tab-panel(name='create')
        q-form(@submit.prevent='createLink')
          q-select(
            v-model='targetType'
            :options='targetOptions'
            label='Тип доступа'
            emit-value
            map-options
            dense
          )

          q-input(
            v-if='targetType === "guest"'
            v-model='linkName'
            label='Название ссылки'
            dense
            class='q-mt-sm'
          )

          q-input(
            v-if='targetType === "member"'
            v-model='targetUsername'
            label='Имя пайщика'
            dense
            class='q-mt-sm'
          )

          q-select(
            v-model='selectedActions'
            :options='actionOptions'
            label='Разрешённые действия'
            multiple
            emit-value
            map-options
            dense
            class='q-mt-sm'
          )

          q-input(
            v-model.number='expiresInDays'
            label='Срок действия (дней, пусто = бессрочно)'
            type='number'
            dense
            class='q-mt-sm'
          )

          q-btn.q-mt-md(
            type='submit'
            color='primary'
            label='Создать ссылку'
            :loading='creating'
            no-caps
          )

      q-tab-panel(name='active')
        q-list(v-if='links.length > 0' separator)
          q-item(v-for='link in links' :key='link.id')
            q-item-section
              q-item-label {{ link.link_name || link.target_username || 'Гость' }}
              q-item-label(caption) {{ link.page_name }} · {{ link.allowed_actions.join(', ') }}
            q-item-section(side)
              q-btn(flat dense icon='content_copy' @click='copyToken(link.token)')
              q-btn(flat dense icon='delete' color='negative' @click='revoke(link.id)')

        .text-center.text-grey-5.q-pa-lg(v-else)
          | Нет активных ссылок
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { client } from 'src/shared/api/client'
import { copyToClipboard, Notify } from 'quasar'

const props = defineProps<{ modelValue: boolean; pagePath: string; pageName: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const isOpen = ref(props.modelValue)
watch(() => props.modelValue, v => { isOpen.value = v })
watch(isOpen, v => { emit('update:modelValue', v) })

const tab = ref('create')
const targetType = ref('guest')
const linkName = ref('')
const targetUsername = ref('')
const selectedActions = ref(['read'])
const expiresInDays = ref<number | undefined>(undefined)
const creating = ref(false)
const links = ref<any[]>([])

const targetOptions = [
  { label: 'Гость (по ссылке)', value: 'guest' },
  { label: 'Пайщик (по имени)', value: 'member' },
]

const actionOptions = [
  { label: 'Просмотр', value: 'read' },
  { label: 'Создание', value: 'create' },
  { label: 'Редактирование', value: 'update' },
  { label: 'Удаление', value: 'delete' },
  { label: 'Выполнение действий', value: 'execute' },
]

onMounted(() => loadLinks())

async function loadLinks() {
  try {
    const { getMyShareLinks } = await client.Query({
      getMyShareLinks: {
        id: true,
        page_path: true,
        page_name: true,
        target_type: true,
        target_username: true,
        link_name: true,
        allowed_actions: true,
        token: true,
        is_active: true,
        created_at: true,
      },
    })
    links.value = (getMyShareLinks || []).filter((l: any) => l.page_path === props.pagePath)
  } catch {}
}

async function createLink() {
  creating.value = true
  try {
    await client.Mutation({
      createShareLink: [{
        data: {
          pagePath: props.pagePath,
          pageName: props.pageName,
          targetType: targetType.value as any,
          targetUsername: targetType.value === 'member' ? targetUsername.value : undefined,
          linkName: targetType.value === 'guest' ? linkName.value : undefined,
          allowedActions: selectedActions.value,
          expiresInDays: expiresInDays.value || undefined,
        },
      }, { id: true, token: true }],
    })
    Notify.create({ type: 'positive', message: 'Ссылка создана' })
    await loadLinks()
    linkName.value = ''
    targetUsername.value = ''
  } catch (e: any) {
    Notify.create({ type: 'negative', message: e?.message || 'Ошибка' })
  } finally {
    creating.value = false
  }
}

async function revoke(id: string) {
  try {
    await client.Mutation({ revokeShareLink: [{ id }, true] })
    Notify.create({ type: 'info', message: 'Ссылка отозвана' })
    await loadLinks()
  } catch {}
}

function copyToken(token: string) {
  const url = `${window.location.origin}${props.pagePath}?share=${token}`
  copyToClipboard(url)
  Notify.create({ type: 'positive', message: 'Ссылка скопирована' })
}

function close() { isOpen.value = false }
</script>
