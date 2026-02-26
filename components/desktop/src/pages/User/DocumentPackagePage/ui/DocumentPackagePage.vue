<template lang="pug">
.q-pa-md
  q-card(v-if="loading" flat)
    q-card-section
      .row.justify-center
        q-spinner(color="primary" size="32px")

  q-card(v-else-if="!pkg" flat)
    q-card-section
      .text-center.text-grey-6
        q-icon(name="search_off" size="48px")
        .q-mt-sm Пакет документов не найден

  template(v-else)
    //- Заголовок пакета
    q-card.q-mb-md(flat)
      q-card-section
        .row.items-center
          q-btn(flat icon="fa-solid fa-arrow-left" @click="$router.back()")
          .text-h6.q-ml-sm {{ pkg.statement?.document?.meta?.title || 'Пакет документов' }}
        .text-caption.text-grey-7.q-ml-lg Хеш: {{ hash }}

    //- Заявление
    q-card.q-mb-md(v-if="pkg.statement" flat)
      q-card-section
        .row.items-center
          q-icon(name="fa-solid fa-file-signature" color="blue" size="sm")
          .text-subtitle1.q-ml-sm Заявление
      q-separator
      q-card-section
        document-item(:doc="pkg.statement" :active-hash="docHash")

    //- Решение
    q-card.q-mb-md(v-if="pkg.decision" flat)
      q-card-section
        .row.items-center
          q-icon(name="fa-solid fa-gavel" color="green" size="sm")
          .text-subtitle1.q-ml-sm Решение совета
      q-separator
      q-card-section
        document-item(:doc="pkg.decision" :active-hash="docHash")

    //- Акты
    q-card.q-mb-md(v-if="pkg.acts && pkg.acts.length" flat)
      q-card-section
        .row.items-center
          q-icon(name="fa-solid fa-file-contract" color="orange" size="sm")
          .text-subtitle1.q-ml-sm Акты ({{ pkg.acts.length }})
      q-separator
      q-card-section
        document-item(v-for="act in pkg.acts" :key="act.document?.hash" :doc="act" :active-hash="docHash")

    //- Связанные документы
    q-card.q-mb-md(v-if="pkg.documents && pkg.documents.length" flat)
      q-card-section
        .row.items-center
          q-icon(name="fa-solid fa-link" color="purple" size="sm")
          .text-subtitle1.q-ml-sm Связанные документы ({{ pkg.documents.length }})
      q-separator
      q-card-section
        document-item(v-for="doc in pkg.documents" :key="doc.document?.hash" :doc="doc" :active-hash="docHash")
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { client } from 'src/shared/api/client'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const pkg = ref<Record<string, any> | null>(null)

const hash = computed(() => route.params.hash as string)
const docHash = computed(() => (route.params.docHash as string) || '')

onMounted(async () => {
  try {
    const result = await client.Query({
      getDocumentPackageByHash: [
        { hash: hash.value },
        {
          statement: {
            document: { hash: true, meta: true, created_at: true },
          },
          decision: {
            document: { hash: true, meta: true, created_at: true },
          },
          acts: {
            document: { hash: true, meta: true, created_at: true },
          },
          documents: {
            document: { hash: true, meta: true, created_at: true },
          },
        },
      ],
    })
    pkg.value = result.getDocumentPackageByHash
  } catch (e) {
    console.warn('Ошибка загрузки пакета:', e)
  } finally {
    loading.value = false
  }
})

const DocumentItem = defineComponent({
  props: { doc: Object, activeHash: String },
  setup(props) {
    const isActive = computed(() => props.doc?.document?.hash === props.activeHash)
    return () => {
      const d = props.doc?.document
      if (!d) return null
      const meta = typeof d.meta === 'string' ? JSON.parse(d.meta) : d.meta
      return h('div', {
        class: ['q-pa-sm', 'rounded-borders', 'cursor-pointer', isActive.value ? 'bg-blue-1' : 'q-hoverable'],
        onClick: () => router.push({ params: { docHash: d.hash } }),
      }, [
        h('div', { class: 'text-body2' }, meta?.title || d.hash?.substring(0, 16) + '...'),
        h('div', { class: 'text-caption text-grey-7' }, d.created_at ? new Date(d.created_at).toLocaleDateString('ru-RU') : ''),
        h('div', { class: 'text-caption text-grey-5' }, d.hash?.substring(0, 32) + '...'),
      ])
    }
  },
})
</script>
