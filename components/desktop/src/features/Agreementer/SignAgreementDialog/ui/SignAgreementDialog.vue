<template lang="pug">
//- Окно без собственной шапки: заголовок стоит в колонке документа, чтобы у
//- страницы был один край — колонка текста — и никаких полос поверх него.
BaseDialog(
  v-model='show',
  :maximized='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  .sign-agreement
    h1.sign-agreement__title {{ title }}
    .sign-agreement__ghost(v-if='isLoading', aria-busy='true', aria-label='Формируем документ')
      q-skeleton(v-for='(w, i) in ghostLines', :key='i', type='text', :width='w')
    slot(v-else)
  template(#footer)
    .sign-agreement__actions
      BaseButton(
        variant='primary',
        :disabled='isLoading',
        :loading='isSubmitting',
        @click='sign'
      ) Подписать
</template>

<script lang="ts" setup>
import { useAgreementStore } from 'src/entities/Agreement';
import { computed, ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { SovietContract } from 'cooptypes';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSignAgreement } from '../model';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
const { info } = useSystemStore()

import { useSessionStore } from 'src/entities/Session';

const session = useSessionStore()
const title = computed(() => props.is_modify ? 'Прочитайте и подпишите обновлённый документ' : 'Прочитайте и подпишите документ')

const props = defineProps({
  agreement: {
    type: Object as () => SovietContract.Tables.CoopAgreements.ICoopAgreement,
    required: true,
  },
  is_modify: {
    type: Boolean,
    required: true
  }
})

const show = ref(true)
const isSubmitting = ref(false)
const isLoading = computed(() => agreementOnSign.value ? false : true)

// Пока документ формируется, в колонке — строки абзацев разной длины.
const ghostLines = ['100%', '96%', '98%', '64%', '100%', '94%', '88%', '100%', '52%']

const {signAgreement} = useSignAgreement()

const agreementStore = useAgreementStore()
const agreementOnSign = computed(() => agreementStore.generatedAgreements.find(el => el.meta.registry_id == props.agreement.draft_id))

const sign = async () => {

  if (!agreementOnSign.value){
    FailAlert('Возникла ошибка подписи документа');
    return
  }

  try {
    isSubmitting.value = true
    await signAgreement(props.agreement.type, agreementOnSign.value)
    const walletStore = useWalletStore()
    // Отмечаем подпись до перечитывания списка: подпись уже в блокчейне, но в
    // базу узла попадёт лишь после разбора блока индексатором, и ответ сервера
    // прямо сейчас её ещё не содержит.
    walletStore.markAgreementSigned(props.agreement.type)
    await walletStore.loadUserWallet({coopname: info.coopname, username: session.username})
    isSubmitting.value = false
    show.value = false
    SuccessAlert('Документ принят')
  } catch(e: any){
    isSubmitting.value = false
    console.error(e)
    FailAlert(`Ошибка подписи документа: ${e.message}`)
  }

}

</script>

<style>
/* Панель с кнопкой — серым холстом под белой страницей документа, чтобы низ
   окна читался отдельно от текста. Без scoped: подвал рисует BaseDialog в
   портале; :has ограничивает правило этим окном. */
.base-dialog__foot:has(.sign-agreement__actions) {
  padding: var(--p-4);
  background: var(--p-canvas);
  border-top-color: var(--p-line-2);
}
</style>

<style scoped>
/* Одна белая страница: колонка текста по центру, поля вокруг — воздух. */
.sign-agreement {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: var(--p-8) 0 var(--p-9);
}

.sign-agreement__title {
  margin: 0 0 var(--p-7);
  color: var(--p-ink);
  font-size: var(--p-fs-h1);
  font-weight: 600;
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
}

.sign-agreement__ghost {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

/* Кнопка живёт в слоте footer BaseDialog — он вне прокрутки, поэтому
   «Подписать» всегда под рукой. Край кнопки совпадает с краем колонки. */
.sign-agreement__actions {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}

@media (max-width: 700px) {
  .sign-agreement {
    padding: var(--p-5) 0 var(--p-7);
  }
  .sign-agreement__title {
    margin-bottom: var(--p-5);
    font-size: var(--p-fs-h2);
    line-height: var(--p-lh-h2);
  }
  .sign-agreement__actions :deep(.base-btn) {
    width: 100%;
  }
}
</style>
