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
 * искать его в другом столе; паевой взнос после выдачи возвращался на
 * свободный паевой Стола заказов, которого в каталоге не видно вовсе.
 *
 * Поэтому баланс стола заказов живёт прямо в шапке каталога, рядом с
 * корзиной, а по нажатию открывается окно с разбивкой по кошелькам и взносом.
 * В шапке стоит общая сумма всех трёх кошельков — человеку важно, на что он
 * вообще может рассчитывать, а не в каком кошельке это лежит; деление по
 * кошелькам ждёт его в окне.
 */

const props = defineProps<{ coopname: string }>();

/** Свободный паевой «Стола заказов» — сюда возвращается паевой взнос после выдачи/отказов, отсюда резервируются новые заказы. */
const MARKET_WALLET = 'w.mkt.share';
/** Главный паевой кошелёк ЦК — источник паевого взноса под заказ. */
const SHARE_WALLET = 'w.wal.share';
/** Членский кошелёк «Стола заказов» — членский взнос участка по заявлению о конвертации; остаток зачитывается при следующем заказе. */
const MEMBER_WALLET = 'w.mkt.member';

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

/** Доступное на кошельке числом — для суммирования, а не для показа. */
function walletValue(walletName: string): number {
  const row = walletStore.user_wallets.find((w) => w.wallet_name === walletName);
  return Number.parseFloat(row?.available ?? '0') || 0;
}

/**
 * Кошельки стола — одним списком: из него рисуются карточки в окне и по нему же
 * считается сумма в шапке. Раздельные описания разъезжаются — сумма начинает
 * жить своей жизнью от той разбивки, которую человек видит рядом.
 */
const WALLET_CARDS = [
  {
    name: MARKET_WALLET,
    icon: 'savings',
    title: 'Свободный паевой Стола заказов',
    subtitle: 'Паевой взнос после выдачи и отказов',
    neutral: false,
    showLocked: true,
  },
  {
    name: MEMBER_WALLET,
    icon: 'card_membership',
    title: 'Членский взнос Стола заказов',
    subtitle: 'Зачитывается в счёт взноса участка по следующему заказу',
    neutral: false,
    showLocked: false,
  },
  {
    name: SHARE_WALLET,
    icon: 'account_balance_wallet',
    title: 'Главный паевой кошелёк',
    subtitle: 'Отсюда паевой взнос резервируется под заказ',
    neutral: true,
    showLocked: false,
  },
] as const;

const walletCards = computed(() =>
  WALLET_CARDS.map((card) => ({
    ...card,
    balance: walletAmount(card.name),
    locked: card.showLocked ? walletLocked(card.name) : undefined,
  })),
);

/**
 * В шапке — всё, чем заказчик может расплатиться: свободный паевой и членский
 * Стола заказов вместе с главным паевым. Прежде там стоял один свободный
 * паевой, и у человека с деньгами на главном кошельке в каталоге висел ноль
 * (жалоба 2026-09-14). Из чего сложилась сумма — видно в окне, которое кнопка
 * и открывает.
 */
const totalAmount = computed(() => {
  const sum = WALLET_CARDS.reduce((acc, card) => acc + walletValue(card.name), 0);
  return formatAsset2Digits(`${sum.toFixed(4)} ${symbol.value}`);
});

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
    | {{ totalAmount }}

BaseDialog(v-model="dialogOpen", title="Кошелёк Стола заказов", size="sm")
  //- Сумма — отдельной строкой под названием (`stacked`): в узком окне длинные
  //- заголовки кошельков иначе жмутся к сумме, и соседние карточки ломаются
  //- по-разному — одна в две строки с суммой сбоку, другая с суммой внизу.
  .mp-wallet
    WalletCard(
      v-for="card in walletCards",
      :key="card.name",
      compact,
      stacked,
      :neutral="card.neutral",
      :icon="card.icon",
      :title="card.title",
      :subtitle="card.subtitle",
      :balance="card.balance",
      :symbol="symbol",
      :locked-balance="card.locked",
      :loading="loading"
    )
    .mp-wallet__hint
      | Имущество оплачивается паевым взносом из главного паевого кошелька.
      | Членский взнос участка переходит из паевого в членский по заявлению о
      | конвертации при оформлении и уходит участку при выдаче; его
      | неиспользованная часть возвращается на членский кошелёк и зачитывается
      | при следующем заказе. После выдачи и отказов паевой взнос возвращается
      | на свободный паевой Стола заказов и идёт на оплату следующих заказов.
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

