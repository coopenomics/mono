<template lang="pug">
div
  SignAgreementDialog(v-for="agreement of required_agreements" v-bind:key="agreement.type" :agreement="agreement" :is_modify="is_modify")
    AgreementReader(:agreement="agreement").q-mb-lg
</template>

<script lang="ts" setup>
import { SignAgreementDialog } from 'src/features/Agreementer/SignAgreementDialog';
import { useAgreementStore } from 'src/entities/Agreement';
import { useSystemStore } from 'src/entities/System/model';
const { info } = useSystemStore()

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { AgreementReader } from 'src/features/Agreementer/GenerateAgreement';
import { useWalletStore } from 'src/entities/Wallet';
import { useSessionStore } from 'src/entities/Session';

const route = useRoute()
const agreementer = useAgreementStore()
const wallet = useWalletStore()

const required = computed(() => (route.meta?.agreements || []))//TODO change to agreements

const userAgreements = computed(() => wallet.agreements)
const templates = computed(() => agreementer.agreementsTemplates)
const cooperativeAgreements = computed(() => agreementer.cooperativeAgreements)
const is_modify=ref(false)

// Для всех соглашений, которые пользователь должен подписать
const AGREEMENT_TYPE_TO_VARS_KEY: Record<string, string> = {
  wallet: 'wallet_agreement',
  privacy: 'privacy_agreement',
  signature: 'signature_agreement',
  user: 'user_agreement',
}
// Используем для проверки того, а нужно ли вообще показывать диалоговое окно
// т.к. переменных vars у кооператива для этого может и не быть еще.
const hasVarsForAgreement = (type: string) => {
  const varsKey = AGREEMENT_TYPE_TO_VARS_KEY[type];
  if (!varsKey) {
    return true;
  }

  const vars = info.vars as
    | Record<
        string,
        { protocol_number?: string | null; protocol_day_month_year?: string | null }
      >
    | undefined;

  if (!vars || !vars[varsKey]) {
    return false;
  }

  const { protocol_number, protocol_day_month_year } = vars[varsKey];

  return Boolean(protocol_number?.trim() && protocol_day_month_year?.trim());
}

const required_agreements = computed(() => {
  // Получаем подписанные соглашения
  if (!session.loadComplete)
    return []

  // Фильтруем соглашения, которые необходимы пользователю
  return cooperativeAgreements.value.filter(agreement => {
    // Условие: тип соглашения должен быть в required.value
    if (required.value.includes(agreement.type)) {
      if (!hasVarsForAgreement(agreement.type)) {
        return false;
      }

      // Найти, если пользователь уже подписал это соглашение
      const userAgreement = userAgreements.value.find(ua => ua.type === agreement.type);

      if (userAgreement) {
        // Найти соответствующий шаблон для соглашения
        const template = templates.value.find(t => t.registry_id === agreement.draft_id);
        // template.version приходит строкой из блокчейна, userAgreement.version — number из GraphQL DTO
        if (template && Number(template.version) !== Number(userAgreement.version)) {
          is_modify.value = true
          return true; // Добавить соглашение в список
        }
      } else {
        return true; // Пользователь ещё не подписал соглашение
      }
    }
    return false; // Убрать соглашение из списка
  });
});

const init = async () => {
  console.log('on init: ', info)
  // Не загружаем данные если кооператив в режиме установки
  if (info.system_status === 'install') {
    return
  }

  agreementer.loadCooperativeAgreements(info.coopname)
  agreementer.loadAgreementTemplates(info.coopname)
}
const session = useSessionStore()

watch(() => session.isAuth, (newValue) => {
  if(newValue)
    init()
})

init()

</script>
