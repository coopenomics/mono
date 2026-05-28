<template lang='pug'>
div
  q-step(
    :name='registratorStore.steps.ReadStatement',
    title='Ознакомьтесь с заполненным заявлением на вступление в кооператив',
    :done='registratorStore.isStepDone("ReadStatement")'
  )

    //- p Прочитайте заявление и примите положения
    div(v-if='isLoading').full-width.text-center.q-mt-lg.q-mb-lg
      Loader(:text='loadingText')
    // eslint-disable-next-line vue/no-v-html
    div(ref='statementDiv' v-if='!isLoading' v-html='html').statement

    .agreements(v-if='!isLoading')
      //- Динамические галочки из конфигурации
      template(v-for='doc in registrationStore.registrationDocuments' :key='doc.id')
        BaseCheckbox(
          block
          :model-value='doc.accepted'
          @update:model-value='(val) => registrationStore.setAgreementAccepted(doc.id, val)'
        )
          | {{ doc.checkbox_text }}
          ReadAgreementDialog(
            v-if='doc.link_text'
            v-model:agree='doc.accepted'
            @update:agree='(val) => registrationStore.setAgreementAccepted(doc.id, val)'
            :text='doc.link_text'
          )
            // eslint-disable-next-line vue/no-v-html
            div(v-html='doc.document.html').q-mb-lg

      //- Устав кооператива (всегда показывается)
      BaseCheckbox(block v-model='registratorStore.state.agreements.ustav')
        | Я прочитал и принимаю
        a(v-if='hasStatuteLink' @click.stop='(event) => event.stopPropagation()' :href='statuteLink' target='_blank').agreements__link Устав кооператива
        span(v-else).agreements__link Устав кооператива

    .row.q-gutter-md.q-mt-lg.q-mb-lg(v-if='!isLoading')
      BaseButton(variant='ghost', @click='back')
        i.fa.fa-arrow-left
        span.q-ml-md назад

      BaseButton(
        variant='primary',
        :disabled='!agreeWithAll',
        @click='registratorStore.next()'
      ) Продолжить
</template>
<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useCreateUser } from 'src/features/User/CreateUser'
import { FailAlert } from 'src/shared/api';
import { Loader } from 'src/shared/ui/Loader';
import { ReadAgreementDialog } from 'src/features/Agreementer/ReadAgreementDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseCheckbox } from 'src/shared/ui/base/BaseCheckbox';

import { useRegistratorStore } from 'src/entities/Registrator'
import { useRegistrationStore } from 'src/entities/Registration'
import { useSystemStore } from 'src/entities/System/model'

const registratorStore = useRegistratorStore()
const registrationStore = useRegistrationStore()
const systemStore = useSystemStore()

const { generateStatementWithoutSignature, generateAllRegistrationDocuments } = useCreateUser()

// Проверка всех галочек (включая динамические соглашения + устав)
const agreeWithAll = computed(() => {
  return (
    registrationStore.allAgreementsAccepted &&
    registratorStore.state.agreements.ustav
  )
})

const html = ref()
const isLoading = ref(false)
const isGenerating = ref(false)
const loadingText = ref('Загружаем документы...')
const statementDiv = ref<any>()

const loadDocuments = async (): Promise<void> => {
  // Защита от повторных вызовов
  if (isGenerating.value) {
    return
  }

  try {
    isGenerating.value = true
    isLoading.value = true
    loadingText.value = 'Генерируем документы для подписи...'

    // Генерируем все документы регистрации с бэкенда (они уже содержат HTML для отображения)
    await generateAllRegistrationDocuments(registratorStore.state.selectedProgramKey || undefined)

    loadingText.value = 'Заполняем заявление...'

    // Генерируем заявление для просмотра
    const document = await generateStatementWithoutSignature()
    html.value = document.html

    isLoading.value = false
    await nextTick()
    statementDiv.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (e: any) {
    isLoading.value = false
    FailAlert(e)
  } finally {
    isGenerating.value = false
  }
}

const back = () => {
  if (registratorStore.isBranched) {
    registratorStore.goTo('SelectBranch');
  } else {
    registratorStore.goTo('GenerateAccount');
  }
}

// Используем только watch с immediate: true вместо onMounted + watch
watch(() => registratorStore.state.step, (value: number) => {
  if (value === registratorStore.steps.ReadStatement) {
    loadDocuments()
  }
}, { immediate: true })

const statuteLink = computed(() => {
  return systemStore.info.vars?.statute_link || ''
})

const hasStatuteLink = computed(() => {
  return statuteLink.value && statuteLink.value.trim() !== ''
})
</script>

<style scoped>
/* HTML-документ заявления приходит из backend сгенерированный, нередко
   с inline-стилями и Quasar text-h* классами, которые перебивают
   нашу типографику. Поэтому здесь — !important на ключевых правилах. */
.statement {
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
  margin: var(--p-4, 16px) 0;
}
.statement :deep(h1),
.statement :deep(.text-h1),
.statement :deep(.text-h2),
.statement :deep(.text-h3) {
  font-size: var(--p-fs-h3, 20px) !important;
  line-height: var(--p-lh-h3, 1.3) !important;
  letter-spacing: 0 !important;
  font-weight: 600 !important;
  color: var(--p-ink) !important;
  text-align: center !important;
  margin: var(--p-6, 24px) 0 var(--p-2, 8px) !important;
}
.statement :deep(h2),
.statement :deep(.text-h4) {
  font-size: var(--p-fs-h4, 16px) !important;
  line-height: var(--p-lh-h4, 1.4) !important;
  font-weight: 600 !important;
  color: var(--p-ink) !important;
  margin: var(--p-5, 20px) 0 var(--p-2, 8px) !important;
}
.statement :deep(h3),
.statement :deep(h4),
.statement :deep(.text-h5),
.statement :deep(.text-h6) {
  font-size: var(--p-fs-body, 14px) !important;
  line-height: var(--p-lh-body, 1.55) !important;
  font-weight: 600 !important;
  color: var(--p-ink) !important;
  margin: var(--p-4, 16px) 0 var(--p-1, 4px) !important;
}
.statement :deep(p) {
  margin: 0 0 var(--p-3, 12px) !important;
  font-size: var(--p-fs-body, 14px) !important;
  line-height: var(--p-lh-body, 1.55) !important;
  color: var(--p-ink) !important;
}
.statement :deep(p:last-child) {
  margin-bottom: 0 !important;
}
.statement :deep(strong),
.statement :deep(b) {
  font-weight: 600;
  color: var(--p-ink);
}
.statement :deep(a) {
  color: var(--p-primary);
  text-decoration: none;
}
.statement :deep(a:hover) {
  text-decoration: underline;
}
/* Quasar text-right + .approved/.meta-right помечаем сжатой ink-2 типографикой.
   Backend может оборачивать «УТВЕРЖДЕНО…» через text-right класс — тогда
   мы дополнительно сжимаем такие параграфы. */
.statement :deep(p.text-right),
.statement :deep(.text-right),
.statement :deep(.approved),
.statement :deep(.meta-right) {
  font-size: var(--p-fs-body-sm, 13px) !important;
  color: var(--p-ink-2) !important;
  line-height: 1.4 !important;
  margin: 0 !important;
}
.statement :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: var(--p-3, 12px) 0;
  font-size: var(--p-fs-body-sm, 13px);
}
.statement :deep(td),
.statement :deep(th) {
  padding: var(--p-2, 8px) var(--p-3, 12px);
  border-bottom: 1px solid var(--p-line);
  vertical-align: top;
}
.statement :deep(ul),
.statement :deep(ol) {
  margin: 0 0 var(--p-3, 12px);
  padding-left: var(--p-6, 24px);
}
.statement :deep(li) {
  margin-bottom: var(--p-1, 4px);
}
.statement :deep(hr) {
  border: none;
  border-top: 1px solid var(--p-line);
  margin: var(--p-5, 20px) 0;
}

/* Контейнер согласий: вертикальный стек с canon-gap. */
.agreements {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  margin: var(--p-4, 16px) 0;
}
.agreements__link {
  margin-left: var(--p-1, 4px);
  color: var(--p-accent);
  text-decoration: none;
}
.agreements__link:hover {
  text-decoration: underline;
}
</style>
