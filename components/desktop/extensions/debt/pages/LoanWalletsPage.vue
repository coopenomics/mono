<template lang="pug">
//- Кошельки займа: сколько можно отдать в обеспечение, сколько уже в обеспечении,
//- сколько выдано и не возвращено. Карточки — канон кошельков.
q-page.loan-wallets
  Teleport(to='#header-actions-host', defer)
    BaseButton(variant='primary', size='sm', @click='createOpen = true')
      template(#icon-left)
        q-icon(name='add', size='16px')
      | {{ $t('debt.loansPage.createAction') }}

  PageHint(storage-key='debt:wallets:banner-dismissed')
    | {{ $t('debt.walletsPage.hint') }}

  //- Две группы: что пайщик может отдать в обеспечение и что уже в обороте займов.
  .loan-wallets__section
    .loan-wallets__eyebrow {{ $t('debt.walletsPage.availableSection') }}
    .loan-wallets__grid
      WalletCard(
        v-for='option in options',
        :key='option.key',
        :program='programOf(option.key)',
        :title='collateralLabel(option.key)',
        :subtitle='option.basis_signed ? $t("debt.walletsPage.availableSubtitle") : $t("debt.walletsPage.basisMissingSubtitle")',
        :balance='amountPart(option.available)',
        :symbol='symbolPart(option.available)',
        :balance-label='$t("debt.walletsPage.availableLabel")',
        :empty='!option.basis_signed || amountOf(option.available) === 0',
        :loading='loading'
      )

  .loan-wallets__section
    .loan-wallets__eyebrow {{ $t('debt.walletsPage.loansSection') }}
    .loan-wallets__grid
      WalletCard(
        neutral,
        icon='lock',
        :title='$t("debt.walletsPage.pledgedTitle")',
        :subtitle='$t("debt.walletsPage.pledgedSubtitle")',
        :balance='amountPart(pledged)',
        :symbol='symbolPart(pledged)',
        :balance-label='$t("debt.walletsPage.pledgedLabel")',
        :empty='amountOf(pledged) === 0',
        :loading='loading'
      )
      WalletCard(
        neutral,
        icon='request_quote',
        :title='$t("debt.walletsPage.issuedTitle")',
        :subtitle='$t("debt.walletsPage.issuedSubtitle")',
        :balance='amountPart(issued)',
        :symbol='symbolPart(issued)',
        :balance-label='$t("debt.walletsPage.issuedLabel")',
        :locked-balance='amountOf(pending) > 0 ? amountPart(pending) : undefined',
        :locked-label='$t("debt.walletsPage.pendingLabel")',
        :empty='amountOf(issued) === 0 && amountOf(pending) === 0',
        :loading='loading'
      )

  LoanCreateDialog(v-model='createOpen', @created='load')
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Ledger2Contract } from 'cooptypes';
import { FailAlert } from 'src/shared/api';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { api as walletApi } from 'src/entities/Wallet';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { PageHint } from 'src/shared/ui/domain/PageHint';
import { WalletCard, type WalletProgram } from 'src/shared/ui/domain/WalletCard';
import { getCollateralOptions, type ICollateralOption } from '../api';
import { amountOf, collateralLabel, formatAmount } from '../model';
import LoanCreateDialog from './LoanCreateDialog.vue';

const system = useSystemStore();
const session = useSessionStore();

const loading = ref(true);
const options = ref<ICollateralOption[]>([]);
const pledged = ref('');
const issued = ref('');
const pending = ref('');
const createOpen = ref(false);

// Кошельки займа в книге учёта: обеспечение, к выдаче, выдано.
const PLEDGE_WALLET = 'w.cap.pledge';
const PENDING_WALLET = 'w.dbt.pend';
const ISSUED_WALLET = 'w.dbt.issued';

const PROGRAM_BY_COLLATERAL: Record<string, WalletProgram> = { blago: 'blagorost' };
const programOf = (key: string): WalletProgram | undefined => PROGRAM_BY_COLLATERAL[key];

const amountPart = (asset: string): string => formatAmount(asset || `0 ${system.governSymbol}`).split(' ')[0] ?? '0,00';
const symbolPart = (asset: string): string => String(asset || '').split(' ')[1] ?? system.governSymbol;

async function load(): Promise<void> {
  try {
    const [collaterals, wallets] = await Promise.all([
      getCollateralOptions(system.info.coopname),
      walletApi.loadUserWalletsData({ coopname: system.info.coopname, username: session.username }),
    ]);
    options.value = collaterals;
    const byName = (name: string): string => wallets.find((w) => w.wallet_name === name)?.available ?? '';
    pledged.value = byName(PLEDGE_WALLET);
    pending.value = byName(PENDING_WALLET);
    issued.value = byName(ISSUED_WALLET);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

useLiveReload([liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)], () => void load());
onMounted(load);
</script>

<style scoped lang="scss">
.loan-wallets {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: var(--p-5);
}

.loan-wallets__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.loan-wallets__eyebrow {
  color: var(--p-ink-2);
  font-size: var(--p-fs-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
}

.loan-wallets__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--p-4);
}
</style>
