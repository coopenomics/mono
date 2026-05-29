<template lang="pug">
BaseDialog(
  v-model='isVisible',
  :title='title',
  :maximized='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  div.row.justify-center
    div(style="padding-bottom: 100px;").col-md-8.col-col-xs-12

      div(v-if="step === 1")
        p.q-mt-lg
          | Кооператив перешёл на двухэтапную систему управления на основании общего собрания уполномоченных председателей кооперативных участков...
        Form(
          :handler-submit="next"
          :is-submitting="isSubmitting"
          :showSubmit="!isLoading"
          :showCancel="false"
          :button-submit-txt="'Продолжить'"
        )
          BranchSelector(
            v-model:selectedBranch="selectedBranch"
            :branches="branches"
          ).q-mb-md

      div(v-else-if="step === 2")
        Loader(v-if="isLoading" :text="`Формируем документ...`")

        div(v-else)
          DocumentHtmlReader(:html="document.html")
          q-btn(@click="back" flat) назад
          q-btn(@click="sign" color="primary") подписать
</template>

<script setup lang="ts">
  import { BaseDialog } from 'src/shared/ui/base/BaseDialog'
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
    next,
    back,
    sign
  } = useSelectBranchProcess()

</script>
<style>
.digital-document .header{
  text-align: center;
}
</style>
