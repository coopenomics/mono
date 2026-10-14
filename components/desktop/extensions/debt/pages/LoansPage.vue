<template lang="pug">
q-page.loans
  //- Главное действие страницы — в шапке.
  Teleport(to='#header-actions-host', defer)
    BaseButton(variant='primary', size='sm', @click='createOpen = true')
      template(#icon-left)
        q-icon(name='add', size='16px')
      | {{ $t('debt.loansPage.createAction') }}

  PageHint(storage-key='debt:my-loans:banner-dismissed')
    | {{ $t('debt.loansPage.hint') }}

  CardListSkeleton(v-if='firstLoad', :count='3')

  EmptyState(
    v-if='!items.length && !firstLoad',
    :title='$t("debt.loansPage.emptyTitle")',
    :body='$t("debt.loansPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='request_quote', size='48px')

  .loans__list(v-if='items.length')
    LoanRow(
      v-for='loan in items',
      :key='loan.debt_hash',
      :loan='loan',
      :signing='signingHash === loan.debt_hash',
      @open='open',
      @sign-act='onSignAct'
    )

  .row.justify-center.q-my-md(v-if='hasMore')
    BaseButton(variant='ghost', :loading='loading', @click='loadMore') {{ $t('debt.loansPage.loadMoreAction') }}

  LoanDetailsDrawer(v-model='drawerOpen', :loan='active', @changed='reload(true)')
  LoanCreateDialog(v-model='createOpen', @created='reset')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import type { ILoan } from '../api';
import { useLiveLoanList, useLoanActions } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { t } from '../i18n';
import LoanRow from '../widgets/LoanRow.vue';
import LoanDetailsDrawer from '../widgets/LoanDetailsDrawer.vue';
import LoanCreateDialog from './LoanCreateDialog.vue';

// Пайщик видит только свои займы — отбор по имени делает сервер.
const filter = ref({});
const { items, loading, firstLoad, hasMore, reload, reset, loadMore } = useLiveLoanList(filter);

const createOpen = ref(false);
const drawerOpen = ref(false);
const activeHash = ref<string | null>(null);
// Панель читает заём из списка: дочитка по ленте обновляет и открытую панель.
const active = computed<ILoan | null>(() => items.value.find((l) => l.debt_hash === activeHash.value) ?? null);

const { signAct } = useLoanActions();
const signingHash = ref<string | null>(null);

async function onSignAct(loan: ILoan): Promise<void> {
  try {
    signingHash.value = loan.debt_hash;
    if (!(await signAct(loan))) return;
    SuccessAlert(t('debt.loanDetails.actSignedMessage'));
    await reload(true);
  } catch (e) {
    FailAlert(e);
  } finally {
    signingHash.value = null;
  }
}

function open(loan: ILoan): void {
  activeHash.value = loan.debt_hash;
  drawerOpen.value = true;
}

onMounted(reload);
</script>

<style scoped lang="scss">
.loans {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: var(--p-5);
}

.loans__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
</style>
