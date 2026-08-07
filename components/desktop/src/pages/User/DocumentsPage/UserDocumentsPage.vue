<template lang="pug">
//- Родитель списка документов пайщика: деталь — child (подсветка «Документы» в matched).
router-view(v-if='!isDocumentsRoot')
q-page.documents-page(v-else)
  ListOfDocumentsWidget(
    :username="username"
    :filter="{}"
    :showFilter="false"
    :initialDocumentType="typeForToggle"
  )

  //- Поиск по документам — действие страницы через canon Teleport в шапку.
  //- Кнопка сама скрывается, если фича поиска выключена (features.search).
  Teleport(to='#header-actions-host', defer)
    SearchHeaderAction
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from 'src/entities/Session'
import { ListOfDocumentsWidget } from 'src/widgets/Cooperative/Documents/ListOfDocuments/ui'
import { SearchHeaderAction } from 'src/features/DocumentSearch'
import type { DocumentType } from 'src/entities/Document/model/types'

const route = useRoute()
const session = useSessionStore()
const username = computed(() => session.username)
const typeForToggle = ref<DocumentType>('newsubmitted')
const isDocumentsRoot = computed(() => route.name === 'user-documents')
</script>

<style lang="scss" scoped>
.documents-page {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .documents-page {
    padding: var(--p-4, 16px);
  }
}
</style>
