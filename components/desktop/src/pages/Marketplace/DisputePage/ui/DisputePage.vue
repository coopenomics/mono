<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Гарантийный возврат
    .hero-subtitle Претензии и диспуты по заказам

  //- Форма претензии
  q-card.q-mt-md(flat v-if="mode === 'create'")
    q-card-section
      .text-h6 Новая претензия

    q-separator

    q-card-section
      q-input(v-model="disputeForm.orderHash" label="Хэш заказа" dense outlined readonly)
      q-input.q-mt-sm(
        v-model="disputeForm.description"
        label="Описание проблемы"
        type="textarea"
        rows="4"
        dense
        outlined
        placeholder="Опишите обнаруженный дефект..."
      )

      .text-subtitle2.q-mt-md Фото/видео подтверждение
      q-file.q-mt-sm(
        v-model="disputeForm.files"
        label="Приложите фото или видео"
        multiple
        accept="image/*,video/*"
        dense
        outlined
      )
        template(#prepend)
          q-icon(name="fa-solid fa-camera")

    q-card-actions
      q-btn(
        color="negative"
        label="Подать претензию"
        icon="fa-solid fa-exclamation-triangle"
        no-caps
        @click="submitDispute"
        :loading="submitting"
      )
      q-btn(flat label="Отмена" @click="$router.back()")

  //- Список активных диспутов
  q-card.q-mt-md(flat v-if="mode === 'list'")
    q-card-section
      .row.items-center
        .text-h6.col Активные претензии

    q-separator

    q-card-section
      q-list(separator)
        q-item(v-for="dispute in disputes" :key="dispute.id" clickable @click="selectDispute(dispute)")
          q-item-section(avatar)
            q-icon(
              :name="disputeStatusIcon(dispute.status)"
              :color="disputeStatusColor(dispute.status)"
              size="sm"
            )
          q-item-section
            q-item-label {{ dispute.description?.substring(0, 100) }}...
            q-item-label(caption) Заказ: {{ dispute.request_hash?.substring(0, 16) }}...
          q-item-section(side)
            q-chip(:color="disputeStatusColor(dispute.status)" text-color="white" dense)
              | {{ disputeStatusLabel(dispute.status) }}

      .text-center.text-grey-5.q-pa-lg(v-if="disputes.length === 0")
        q-icon(name="fa-solid fa-shield-halved" size="48px")
        .q-mt-sm Нет активных претензий

  //- Детали диспута
  q-card.q-mt-md(flat v-if="mode === 'detail' && selectedDispute")
    q-card-section
      .row.items-center
        q-btn(flat icon="fa-solid fa-arrow-left" @click="goToList")
        .text-h6.q-ml-sm Претензия {{ selectedDispute.id }}

    q-separator

    q-card-section
      //- Timeline диспута
      q-timeline(color="primary")
        q-timeline-entry(title="Претензия подана" icon="fa-solid fa-exclamation-triangle" color="red")
          div {{ selectedDispute.description }}
          div.text-caption.text-grey {{ formatDate(selectedDispute.created_at) }}

        q-timeline-entry(
          title="Рассмотрение на КУ"
          icon="fa-solid fa-building"
          :color="selectedDispute.status !== 'pending' ? 'blue' : 'grey'"
        )
          div(v-if="selectedDispute.branch_decision") Решение КУ: {{ selectedDispute.branch_decision }}
          div(v-else) Ожидает рассмотрения председателем КУ

        q-timeline-entry(
          title="Спор с поставщиком"
          icon="fa-solid fa-comments"
          :color="selectedDispute.supplier_response ? 'orange' : 'grey'"
        )
          div(v-if="selectedDispute.supplier_response")
            q-banner.bg-orange-1.text-orange-9(rounded)
              | {{ selectedDispute.supplier_response }}
          div(v-else) Ожидает ответа поставщика

        q-timeline-entry(
          title="Решение совета"
          icon="fa-solid fa-gavel"
          :color="selectedDispute.council_decision ? 'green' : 'grey'"
        )
          div(v-if="selectedDispute.council_decision === 'approved'")
            q-chip(color="green" text-color="white") Возврат одобрен
          div(v-else-if="selectedDispute.council_decision === 'rejected'")
            q-chip(color="red" text-color="white") Возврат отклонён
          div(v-else) Ожидает решения совета

        q-timeline-entry(
          v-if="selectedDispute.council_decision === 'approved'"
          title="Возврат имущества"
          icon="fa-solid fa-rotate-left"
          :color="selectedDispute.returned ? 'green' : 'grey'"
        )
          div(v-if="selectedDispute.returned") Имущество возвращено, средства разблокированы
          div(v-else) Ожидает возврата имущества на КУ
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const mode = ref<'create' | 'list' | 'detail'>(route.query.create ? 'create' : 'list')
const submitting = ref(false)
const disputes = ref<any[]>([])
const selectedDispute = ref<any>(null)

const disputeForm = reactive({
  orderHash: (route.query.hash as string) || '',
  description: '',
  files: null as any,
})

function disputeStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'orange', reviewing: 'blue', supplier_response: 'purple',
    council_review: 'teal', approved: 'green', rejected: 'red', returned: 'grey',
  }
  return map[status] || 'grey'
}

function disputeStatusIcon(status: string) {
  const map: Record<string, string> = {
    pending: 'fa-solid fa-clock', reviewing: 'fa-solid fa-search',
    supplier_response: 'fa-solid fa-comments', council_review: 'fa-solid fa-gavel',
    approved: 'fa-solid fa-check', rejected: 'fa-solid fa-times', returned: 'fa-solid fa-rotate-left',
  }
  return map[status] || 'fa-solid fa-question'
}

function disputeStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'Ожидает', reviewing: 'На рассмотрении', supplier_response: 'Ответ поставщика',
    council_review: 'Совет', approved: 'Одобрено', rejected: 'Отклонено', returned: 'Возвращено',
  }
  return map[status] || status
}

function formatDate(d: string) {
  return d ? new Date(d).toLocaleString('ru-RU') : '-'
}

function selectDispute(d: any) {
  selectedDispute.value = d
  mode.value = 'detail'
}

function goToList() {
  mode.value = 'list'
}

function submitDispute() {
  submitting.value = false
}
</script>
