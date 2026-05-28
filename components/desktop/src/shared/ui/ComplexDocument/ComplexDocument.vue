<template lang="pug">
.row.justify-center
  div.documents-gap.col-md-10.col-xs-12
    // Отображение основного документа с агрегатом
    BaseDocument(
      v-if="documentData.statement && documentData.statement.documentAggregate"
      :documentAggregate="documentData.statement.documentAggregate"
    ).q-mt-md

    // Отображение документа решения с агрегатом
    BaseDocument(
      v-if="documentData.decision && documentData.decision.documentAggregate"
      :documentAggregate="documentData.decision.documentAggregate"
    ).q-mt-md

    // Отображение связанных документов из агрегата
    div(v-if="documentData.links.length > 0 && documentData.statement")
      div(
        v-for="linkedDoc, index in documentData.links"
        v-bind:key="index"
      ).documents-gap
        BaseDocument(
          :documentAggregate="linkedDoc"
        ).q-mt-md


</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BaseDocument } from '../BaseDocument';
import type { IDocumentPackageAggregate } from 'src/entities/Document/model/types'

const props = defineProps({
  documents: {
    type: Object as () => IDocumentPackageAggregate,
    required: true
  },
})

// Просто используем документы как есть
const documentData = computed(() => props.documents)
</script>

<style lang="scss" scoped>

</style>
