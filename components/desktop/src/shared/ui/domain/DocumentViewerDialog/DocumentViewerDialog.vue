<template lang="pug">
//- Core-виджет просмотра документа во всю ширину экрана без переадресации.
//- Принимает УЖЕ загруженный агрегат документа (document + rawDocument) и
//- рендерит его телом BaseDocument (HTML + подписи + скачивание). Ничего не
//- догружает и никуда не ведёт — нужен там, где у пользователя есть доступ
//- к самому документу, но не обязательно к реестру документов совета
//- (например, стол бухгалтера открывает документы из реестра процессов).
BaseDialog(
  :model-value='modelValue'
  :title='title'
  maximized
  @update:model-value='(v) => emit("update:modelValue", v)'
)
  BaseDocument(
    v-if='modelValue && documentAggregate'
    :document-aggregate='documentAggregate'
  )
  .text-body2.text-grey-7(v-else) Документ недоступен
</template>

<script setup lang="ts">
import { BaseDialog } from 'src/shared/ui/base'
import { BaseDocument } from 'src/shared/ui/BaseDocument'
import type { IDocumentAggregate } from 'src/entities/Document/model'

defineProps<{
  modelValue: boolean
  documentAggregate: IDocumentAggregate | null
  title?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
