<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { DepositButton } from 'src/features/Wallet/DepositToWallet';
import { useWalletStore, type ILoadUserWallet } from 'src/entities/Wallet';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

/**
 * Кошелёк в шапке стола заказов (правка 2026-08-13).
 *
 * Заказчик живёт в каталоге, а деньги видел только на столе пайщика: при
 * нехватке средств окно предлагало «пополнить кошелёк», и человек уходил
 * искать его в другом столе; возврат по гарантии приходил на программный
 * кошелёк, которого в каталоге не видно вовсе — и его не находили.
 *
 * Поэтому баланс стола заказов живёт прямо в шапке каталога, рядом с
 * корзиной, а по нажатию открывается окно с обоими кошельками и взносом.
 * Главный паевой кошелёк на своём месте (стол пайщика) — здесь он показан
 * справочно, чтобы было видно, из чего оплачивается заказ.
 */

const props = defineProps<{ coopname: string }>();

/** Программный кошелёк «Стола заказов» — из него платятся заказы и на него приходят возвраты. */
const MARKET_WALLET = 'w.mkt.member';
/** Главный паевой кошелёк ЦК — источник средств для конвертации в членский. */
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
      icon="card_membership",
      title="Кошелёк Стола заказов",
      subtitle="Оплата заказов и возвраты",
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
      subtitle="Отсюда средства идут на заказ",
      :balance="walletAmount(SHARE_WALLET)",
      :symbol="symbol",
      :loading="loading"
    )
    .mp-wallet__hint
      | Не хватает средств на заказ — пополните паевой кошелёк взносом, и сумма
      | перейдёт в членский при оформлении.
  template(#footer)
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
