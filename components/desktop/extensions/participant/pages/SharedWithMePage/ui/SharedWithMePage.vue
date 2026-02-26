<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Доступные мне
    .hero-subtitle Страницы, к которым вам предоставлен доступ

  q-card.q-mt-md(flat)
    q-card-section
      q-table(
        :rows='sharedLinks'
        :columns='columns'
        row-key='id'
        flat
        :loading='loading'
      )
        template(#body-cell-page='props')
          q-td(:props='props')
            .text-weight-medium {{ props.row.page_name }}
            .text-caption.text-grey {{ props.row.page_path }}

        template(#body-cell-from='props')
          q-td(:props='props')
            q-chip(dense color='blue-2' text-color='blue-9')
              | {{ props.row.link_name || 'Без имени' }}

        template(#body-cell-actions_list='props')
          q-td(:props='props')
            q-chip(
              v-for='action in props.row.allowed_actions'
              :key='action'
              dense
              color='grey-3'
              text-color='grey-8'
            ).q-mr-xs {{ actionLabel(action) }}

        template(#body-cell-expires='props')
          q-td(:props='props')
            span(v-if='props.row.expires_at') {{ formatDate(props.row.expires_at) }}
            q-chip(v-else dense color='green-2' text-color='green-9') Бессрочно

        template(#body-cell-go='props')
          q-td(:props='props')
            q-btn(
              flat
              dense
              icon='fa-solid fa-arrow-right'
              color='primary'
              @click='navigateTo(props.row)'
            )
              q-tooltip Перейти

      .text-center.text-grey-5.q-pa-lg(v-if='sharedLinks.length === 0 && !loading')
        q-icon(name='fa-solid fa-share-nodes' size='48px')
        .q-mt-sm Нет предоставленных страниц
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { client } from 'src/shared/api/client'
import { Notify } from 'quasar'

interface SharedLink {
  id: string
  page_path: string
  page_name: string
  target_type: string
  link_name?: string
  allowed_actions: string[]
  token: string
  is_active: boolean
  expires_at?: string
}

const router = useRouter()
const sharedLinks = ref<SharedLink[]>([])
const loading = ref(false)

const columns = [
  { name: 'page', label: 'Страница', field: 'page_name', align: 'left' as const },
  { name: 'from', label: 'Название', field: 'link_name', align: 'left' as const },
  { name: 'actions_list', label: 'Разрешения', field: 'allowed_actions', align: 'left' as const },
  { name: 'expires', label: 'Истекает', field: 'expires_at', align: 'center' as const },
  { name: 'go', label: '', field: 'id', align: 'right' as const },
]

function actionLabel(action: string) {
  const map: Record<string, string> = {
    read: 'Чтение',
    create: 'Создание',
    update: 'Изменение',
    delete: 'Удаление',
    execute: 'Выполнение',
    manage: 'Управление',
  }
  return map[action] || action
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU')
}

function navigateTo(link: SharedLink) {
  const url = link.page_path.includes('?')
    ? `${link.page_path}&share_token=${link.token}`
    : `${link.page_path}?share_token=${link.token}`
  router.push(url)
}

onMounted(async () => {
  loading.value = true
  try {
    const { getSharedWithMe } = await client.Query({
      getSharedWithMe: {
        id: true,
        page_path: true,
        page_name: true,
        target_type: true,
        link_name: true,
        allowed_actions: true,
        token: true,
        is_active: true,
        expires_at: true,
      },
    })
    sharedLinks.value = (getSharedWithMe || []).filter((l: any) => l.is_active)
  } catch (e: any) {
    Notify.create({ type: 'negative', message: e?.message || 'Ошибка загрузки' })
  }
  loading.value = false
})
</script>
