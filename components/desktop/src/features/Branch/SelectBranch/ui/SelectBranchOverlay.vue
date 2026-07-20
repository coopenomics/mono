<template lang="pug">
BaseDialog(
  v-model='isVisible',
  :title='title',
  :maximized='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  div.row.justify-center.select-branch-overlay__content
    div.col-md-8.col-xs-12

      div(v-if="step === 1")
        p.q-mt-lg
          | Кооператив перешёл на двухэтапную систему управления на основании общего собрания уполномоченных председателей кооперативных участков...
        Loader(v-if="branchesLoading" text="Загружаем список кооперативных участков...")
        Form#select-branch-form(
          v-else
          :handler-submit="next"
          :is-submitting="isSubmitting"
          :showSubmit="false"
          :showCancel="false"
        )
          BranchSelector(
            v-model:selectedBranch="selectedBranch"
            :branches="branches"
          ).q-mb-md

      div(v-else-if="step === 2")
        Loader(v-if="isLoading" :text="`Формируем документ...`")
        DocumentHtmlReader(v-else :html="document.html")

  template(#footer)
    .select-branch-overlay__actions(v-if="step === 1 && !branchesLoading")
      BaseButton(
        variant='primary',
        type='submit',
        form='select-branch-form',
        :loading='isLoading',
        :disabled='!selectedBranch || isLoading',
      ) Продолжить
    .select-branch-overlay__actions(v-else-if="step === 2 && !isLoading")
      BaseButton(variant='ghost', @click='back') назад
      BaseButton(
        variant='primary',
        :loading='isSubmitting',
        @click='sign'
      ) подписать
</template>

<script setup lang="ts">
  import { BaseDialog } from 'src/shared/ui/base/BaseDialog'
  import { BaseButton } from 'src/shared/ui/base/BaseButton'
  import { Form } from 'src/shared/ui/Form'
  import { Loader } from 'src/shared/ui/Loader'
  import { BranchSelector } from 'src/shared/ui/BranchSelector'
  import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader'

  import { useSelectBranch } from '../model'
  import { useSelectBranchProcess } from 'src/processes/select-branch'

  const { isVisible } = useSelectBranch()
  const {
    title,
    step,
    selectedBranch,
    branches,
    document,
    isSubmitting,
    isLoading,
    branchesLoading,
    next,
    back,
    sign
  } = useSelectBranchProcess()

</script>
<style scoped lang="scss">
/* Кнопки в слоте footer BaseDialog — вне скроллящегося body,
   поэтому «Продолжить» / «подписать» всегда видны на мобильных. */
.select-branch-overlay__actions {
  width: 100%;
  display: flex;
  gap: var(--p-2, 8px);
  justify-content: flex-end;
  flex-wrap: wrap;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.select-branch-overlay__content {
  padding-bottom: var(--p-2, 8px);
}
</style>

<style>
.digital-document .header{
  text-align: center;
}
</style>
