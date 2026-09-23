<template lang="pug">
BaseDialog(
  v-model='show',
  :title='title',
  :maximized='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  //- Документ лежит листом на мягком фоне окна. Пока он формируется, на месте
  //- листа — его набросок: те же поля и ритм строк, без рамки и спиннера.
  .sign-agreement
    .sign-agreement__sheet(v-if='isLoading', aria-busy='true')
      .sign-agreement__caption Формируем документ…
      .sign-agreement__ghost-head
        q-skeleton(type='text', width='22%')
        q-skeleton(type='text', width='30%')
        q-skeleton(type='text', width='18%')
      .sign-agreement__ghost-title
        q-skeleton(type='rect', height='28px', width='56%')
        q-skeleton(type='rect', height='28px', width='40%')
      .sign-agreement__ghost-body
        q-skeleton(v-for='(w, i) in ghostLines', :key='i', type='text', :width='w')
    .sign-agreement__sheet(v-else)
      slot
  template(#footer)
    .sign-agreement__actions
      span.sign-agreement__hint Подпись ставится вашим ключом
      BaseButton(
        variant='primary',
        size='lg',
        :disabled='isLoading',
        :loading='isSubmitting',
        @click='sign'
      )
        template(#icon-left)
          q-icon(name='draw', size='18px')
        | Подписать
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

// Ширины строк наброска: абзацы разной длины, последняя строка короче.
const ghostLines = ['100%', '96%', '98%', '72%', '100%', '94%', '88%', '100%', '60%']

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
/* Фон окна подписи — мягкий холст, на нём белый лист документа. Селектор
   без scoped: тело окна рисует BaseDialog, который выносится в портал. */
.base-dialog__body:has(> .sign-agreement) {
  background: var(--p-canvas);
}
</style>

<style scoped>
.sign-agreement {
  padding: var(--p-6) var(--p-4) var(--p-8);
}

.sign-agreement__sheet {
  max-width: 860px;
  margin: 0 auto;
  padding: var(--p-9) var(--p-9) var(--p-8);
  background: var(--p-surface);
  border-radius: var(--p-r-lg);
  box-shadow: var(--p-shadow-card);
}

.sign-agreement__caption {
  margin-bottom: var(--p-7);
  text-align: center;
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}

.sign-agreement__ghost-head {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-2);
}

.sign-agreement__ghost-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-3);
  margin: var(--p-9) 0 var(--p-8);
}

.sign-agreement__ghost-body {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

/* Кнопка живёт в слоте footer BaseDialog — он вне скроллящегося body,
   поэтому «Подписать» всегда прижата к низу и доступна без прокрутки
   длинного документа. Панель выровнена по ширине листа. */
.sign-agreement__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-4);
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
}

.sign-agreement__hint {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}

@media (max-width: 700px) {
  .sign-agreement {
    padding: var(--p-3) 0 var(--p-6);
  }
  .sign-agreement__sheet {
    padding: var(--p-5) var(--p-4);
  }
  .sign-agreement__actions {
    flex-direction: column;
    align-items: stretch;
    gap: var(--p-2);
  }
  .sign-agreement__hint {
    text-align: center;
  }
}
</style>
