<template lang="pug">
q-dialog(v-model='isOpen' position='top' transition-show='slide-down' transition-hide='slide-up')
  q-card(style='width: 700px; max-width: 90vw; margin-top: 60px')
    q-card-section
      .row.items-center
        q-icon(name='search' size='24px' color='primary')
        q-input.col(
          v-model='searchQuery'
          placeholder='Поиск по документам...'
          dense
          borderless
          autofocus
          @update:model-value='onSearch'
          style='font-size: 16px; padding-left: 12px'
        )
        q-btn(flat round dense icon='close' @click='close')

    q-separator

    q-card-section(v-if='loading' style='min-height: 100px')
      .row.justify-center.items-center(style='height: 100px')
        q-spinner(color='primary' size='32px')

    q-card-section.q-pt-none(v-else-if='results.length > 0' style='max-height: 60vh; overflow-y: auto')
      q-list(separator)
        q-item(
          v-for='result in results'
          :key='result.hash'
          clickable
          @click='openDocument(result)'
        )
          q-item-section
            q-item-label.doc-title {{ result.full_title }}
            q-item-label(caption)
              .row.items-center(style='gap: 8px; margin-top: 4px')
                BaseBadge(v-if='result.signer' variant='neutral') {{ result.signer }}
                span.text-grey-7 {{ formatDate(result.created_at) }}

    q-card-section(v-else-if='searchQuery.length >= 2 && !loading')
      .text-center.text-grey-6(style='padding: 24px')
        q-icon(name='search_off' size='48px')
        .q-mt-sm Ничего не найдено

    q-card-section(v-else)
      .text-center.text-grey-5(style='padding: 24px')
        | Введите запрос для поиска по документам
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { client } from 'src/shared/api/client'
import { BaseBadge } from 'src/shared/ui/base/BaseBadge'
import { DocumentModel } from 'src/entities/Document'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const isOpen = ref(props.modelValue)
const searchQuery = ref('')
const results = ref<any[]>([])
const loading = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (val) => { isOpen.value = val })
watch(isOpen, (val) => { emit('update:modelValue', val) })

function onSearch(query: string | number | null) {
  if (searchTimeout) clearTimeout(searchTimeout)

  const q = String(query || '')
  if (q.length < 2) {
    results.value = []
    return
  }

  loading.value = true
  searchTimeout = setTimeout(async () => {
    try {
      const response = await client.Query({
        searchDocuments: [
          { data: { query: q, limit: 20 } },
          {
            hash: true,
            full_title: true,
            username: true,
            signer: true,
            coopname: true,
            registry_id: true,
            created_at: true,
            highlights: true,
          },
        ],
      })
      results.value = response.searchDocuments || []
    } catch (e) {
      console.warn('Ошибка поиска:', e)
      results.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

const { openDocument: navigateToDocument } = DocumentModel.useDocumentNavigation()

// Открываем отдельную страницу документа по hash и закрываем диалог.
// Страница сама загрузит документ (работает и при прямом переходе по ссылке).
function openDocument(result: any) {
  if (result?.hash) navigateToDocument(String(result.hash))
  close()
}

function close() {
  isOpen.value = false
  searchQuery.value = ''
  results.value = []
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
</script>
