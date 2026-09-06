<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { DepositButton } from 'src/features/Wallet/DepositToWallet';
import { useWalletStore, type ILoadUserWallet } from 'src/entities/Wallet';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { recallShare } from 'src/pages/Marketplace/OperatorBranchEconomy/api';

/**
 * Кошелёк в шапке стола заказов (правка 2026-08-13).
 *
 * Заказчик живёт в каталоге, а деньги видел только на столе пайщика: при
 * нехватке средств окно предлагало «пополнить кошелёк», и человек уходил
 * искать его в другом столе; паевой взнос после выдачи возвращался на
 * свободный паевой Стола заказов, которого в каталоге не видно вовсе.
 *
 * Поэтому баланс стола заказов живёт прямо в шапке каталога, рядом с
 * корзиной, а по нажатию открывается окно с обоими кошельками и взносом.
 * Главный паевой кошелёк на своём месте (стол пайщика) — здесь он показан
 * справочно, чтобы было видно, из чего оплачивается заказ.
 */

const props = defineProps<{ coopname: string }>();

/** Свободный паевой «Стола заказов» — сюда возвращается паевой взнос после выдачи/отказов, отсюда резервируются новые заказы. */
const MARKET_WALLET = 'w.mkt.share';
/** Главный паевой кошелёк ЦК — источник паевого взноса под заказ. */
const SHARE_WALLET = 'w.wal.share';

const walletStore = useWalletStore();
const session = useSessionStore();
const { info } = useSystemStore();

const dialogOpen = ref(false);
const loading = ref(false);

const symbol = computed(() => info.symbols?.root_govern_symbol || 'RUB');

function walletAmount(walletName: string): string {
  const row = walletStore.user_wallets.find((w) => w.wallet_name === walletName);
  if (!row?.available) return '0,00';
  return formatAsset2Digits(row.available).split(' ')[0] || '0,00';
}

function walletLocked(walletName: string): string | undefined {
  const row = walletStore.user_wallets.find((w) => w.wallet_name === walletName);
  if (!row?.blocked || Number.parseFloat(row.blocked) <= 0) return undefined;
  return formatAsset2Digits(row.blocked).split(' ')[0];
}

const marketAmount = computed(() => walletAmount(MARKET_WALLET));

// Отзыв свободного паевого: весь свободный остаток Стола заказов возвращается
// в главный паевой кошелёк (contract: recallshare, o.mkt.recall).
const recalling = ref(false);
async function recallAll(): Promise<void> {
  const row = walletStore.user_wallets.find((w) => w.wallet_name === MARKET_WALLET);
  const amount = row?.available ? Number.parseFloat(String(row.available)) : 0;
  if (!(amount > 0)) return;
  recalling.value = true;
  try {
    await recallShare({ amount });
    SuccessAlert('Паевой взнос возвращён в Кошелёк.');
    await loadWallets();
  } catch (e) {
    FailAlert(e, 'Не удалось отозвать паевой взнос');
  } finally {
    recalling.value = false;
  }
}

async function loadWallets(): Promise<void> {
  if (!session.username) return;
  loading.value = true;
  try {
    await walletStore.loadUserWallet({
      coopname: props.coopname,
      username: session.username,
    } as ILoadUserWallet);
  } finally {
    loading.value = false;
  }
}

// Кошелёк в каталоге открывают чаще, чем стол пайщика, — данные тянем сами,
// не полагаясь на то, что их уже загрузил другой стол.
onMounted(() => void loadWallets());

function openDialog(): void {
  dialogOpen.value = true;
  void loadWallets();
}
</script>

<template lang="pug">
Teleport(to="#header-actions-host", defer)
  BaseButton(
    v-if="session.username",
    variant="secondary",
    size="sm",
    aria-label="Кошелёк Стола заказов",
    @click="openDialog"
  )
    template(#icon-left)
      q-icon(name="account_balance_wallet", size="16px")
    | {{ marketAmount }} {{ symbol }}

BaseDialog(v-model="dialogOpen", title="Кошелёк Стола заказов", size="sm")
  //- Сумма — отдельной строкой под названием (`stacked`): в узком окне длинные
  //- заголовки кошельков иначе жмутся к сумме, и соседние карточки ломаются
  //- по-разному — одна в две строки с суммой сбоку, другая с суммой внизу.
  .mp-wallet
    WalletCard(
      compact,
      stacked,
      icon="savings",
      title="Свободный паевой Стола заказов",
      subtitle="Паевой взнос после выдачи и отказов",
      :balance="marketAmount",
      :symbol="symbol",
      :locked-balance="walletLocked(MARKET_WALLET)",
      :loading="loading"
    )
    WalletCard(
      compact,
      stacked,
      neutral,
      icon="account_balance_wallet",
      title="Главный паевой кошелёк",
      subtitle="Отсюда паевой взнос резервируется под заказ",
      :balance="walletAmount(SHARE_WALLET)",
      :symbol="symbol",
      :loading="loading"
    )
    .mp-wallet__hint
      | Заказ оплачивается паевым взносом из главного паевого кошелька. После
      | выдачи и отказов паевой взнос возвращается на свободный паевой Стола
      | заказов — им оплачивается следующий заказ, либо его можно отозвать в
      | Кошелёк.
  template(#footer)
    BaseButton(
      v-if="Number.parseFloat(marketAmount.replace(',', '.')) > 0",
      variant="secondary",
      :loading="recalling",
      @click="recallAll"
    ) Отозвать в Кошелёк
    DepositButton
</template>

<style scoped lang="scss">
.mp-wallet {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__hint {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }
}
</style>
