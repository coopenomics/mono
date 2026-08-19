<template lang="pug">
.left-drawer-menu
  AppDrawer.left-drawer-menu__rail(
    :items='railItems',
    :active-key='activeKey',
    :coop-name='coopShortName',
    :coop-meta='coopMeta',
    :show-cmdk='true',
    cmdk-label='Найти',
    cmdk-hint='Поиск (⌘K)',
    @select='onSelect',
    @cmdk='onCmdk'
  )
    //- Переопределяем стандартный brand-row на WorkspaceSwitcher:
    //- кооп + текущий стол + меню переключения столов.
    template(#brand)
      WorkspaceSwitcher.left-drawer-menu__ws

    template(#footer)
      RailUserCard(
        v-if='walletReady',
        v-model:collapsed='userCardCollapsed',
        :name='userName',
        :role='userRoleLabel',
        :balance='walletBalance',
        :symbol='walletSymbol',
        :locked-balance='walletLocked',
        balance-label='Главный паевой кошелёк',
        :balance-route='{ name: "wallet", params: { coopname: info.coopname } }',
        primary-action-label='Пополнить',
        show-signout,
        signout-label='Выйти из кабинета',
        @primary-action='onDeposit',
        @signout='onLogout'
      )
      .left-drawer-menu__version(:title='`Версия ${updateWatch.currentVersion}`')
        NodeSyncIndicator
        span v{{ updateWatch.currentVersion }}

  //- Невидимые носители canon-диалогов: рендерятся в q-portal,
  //- открываются глобальными ref'ами через useDepositDialog().open() /
  //- useWithdrawDialog().open() из onDeposit/onWithdraw выше.
  .left-drawer-menu__hidden-dialogs(aria-hidden='true')
    DepositButton(:micro='true')
    WithdrawButton(:micro='true')

  //- Замок без PIN-кода не запирает ничего, поэтому первое запирание идёт через
  //- установку PIN — и уже после неё кошелёк запирается.
  SetPinDialog(
    v-model='askPinBeforeLock',
    lead='Чтобы запирать кошелёк, задайте PIN-код: им он и будет отпираться.',
    @saved='session.lockWalletNow()'
  )
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { SetPinDialog } from 'src/features/Security/SetupPin';
import { useSystemStore } from 'src/entities/System/model';
import { NodeSyncIndicator } from 'src/entities/System/ui';
import { useWalletStore } from 'src/entities/Wallet';
import { useCommandPaletteStore } from 'src/entities/CommandPalette/model';
import { useActionsStore } from 'src/shared/lib/stores/actions.store';
import { useLogoutUser } from 'src/features/User/Logout';
import { useDepositDialog, DepositButton } from 'src/features/Wallet/DepositToWallet';
import { WithdrawButton } from 'src/features/Wallet/WithdrawFromWallet';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { AppDrawer } from 'src/shared/ui/layout/AppDrawer';
import type { RailItem } from 'src/shared/ui/layout/AppDrawer';
import { useMenuSubItemsReader } from 'src/shared/hooks/useMenuSubItems';
import { RailUserCard } from 'src/shared/ui/domain/RailUserCard';
import { WorkspaceSwitcher } from 'src/widgets/Desktop/WorkspaceSwitcher';
import { useUpdateWatch } from 'src/entities/AppVersion/model';

const router = useRouter();
const updateWatch = useUpdateWatch();
const desktop = useDesktopStore();
const session = useSessionStore();
const systemStore = useSystemStore();
const { info } = systemStore;
const walletStore = useWalletStore();
const actionsStore = useActionsStore();
const palette = useCommandPaletteStore();
const { subItemsFor } = useMenuSubItemsReader();

// --- Адаптер: activeSecondLevelRoutes → RailItem[] -------------------------

const userRole = computed<'chairman' | 'member' | 'user'>(() =>
  session.isChairman ? 'chairman' : session.isMember ? 'member' : 'user',
);

const filterContext = computed(() => {
  const acc = session.currentUserAccount?.private_account;
  const isCoop =
    acc?.type === Zeus.AccountType.organization &&
    acc.organization_data &&
    'type' in acc.organization_data &&
    acc.organization_data.type.toUpperCase() === Zeus.OrganizationType.COOP;
  return {
    isCoop,
    userRole: userRole.value,
    userAccount: acc,
    coopname: info.coopname,
    isOnboardingHidden:
      localStorage.getItem('chairman-onboarding-hidden') === 'true',
  };
});

function evalCondition(
  condition: string | undefined,
  ctx: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  try {
    const fn = new Function(...Object.keys(ctx), `return ${condition};`);
    return Boolean(fn(...Object.values(ctx)));
  } catch (e) {
    console.error('Error evaluating route condition:', e);
    return false;
  }
}

interface MenuMeta {
  title?: string;
  icon?: string;
  roles?: string[];
  conditions?: string;
  hidden?: boolean;
  action?: string;
}

const filteredRoutes = computed<RouteRecordRaw[]>(() => {
  const ctx = filterContext.value;
  const wsName = desktop.activeWorkspaceName;
  if (!wsName) return [];
  return (desktop.activeSecondLevelRoutes as RouteRecordRaw[]).filter((r) => {
    const meta = (r.meta ?? {}) as MenuMeta;
    if (meta.hidden) return false;
    if (!evalCondition(meta.conditions, ctx)) return false;
    // Canon-grants: для grant-стола проверяется meta.requires против выданных
    // бэкендом прав; для legacy-стола fallback на meta.roles по core-роли.
    return desktop.isPageVisible(r.meta, wsName);
  });
});

const railItems = computed<RailItem[]>(() =>
  filteredRoutes.value.map((r) => {
    const meta = (r.meta ?? {}) as MenuMeta;
    const children = subItemsFor(String(r.name));
    return {
      key: String(r.name),
      label: meta.title ?? String(r.name),
      icon: meta.icon,
      ...(children.length ? { children } : {}),
    };
  }),
);

// --- Активный пункт через router -------------------------------------------

const activeKey = computed<string | undefined>(() => {
  const current = router.currentRoute.value;
  const currentName = current.name as string | undefined;
  if (!currentName) return undefined;

  for (const r of filteredRoutes.value) {
    if (r.name === currentName) return String(r.name);
    if (current.matched.some((m) => m.name === r.name)) return String(r.name);
  }
  return undefined;
});

// --- Навигация -------------------------------------------------------------

function onSelect(item: RailItem): void {
  const route = filteredRoutes.value.find((r) => String(r.name) === item.key);
  if (!route) {
    // Суб-пункт (например, избранное): переход делает его router-link,
    // здесь остаётся только закрыть drawer на мобильном.
    if (item.route) desktop.closeLeftDrawerOnMobile();
    return;
  }
  const meta = (route.meta ?? {}) as MenuMeta;
  if (meta.action) {
    actionsStore.executeAction(meta.action);
    desktop.closeLeftDrawerOnMobile();
    return;
  }
  void router.push({
    name: route.name,
    params: { coopname: info.coopname },
  });
  desktop.closeLeftDrawerOnMobile();
}

function onCmdk(): void {
  // Открываем canon-палитру команд через её store; диалог mount'ится в layout.
  palette.open();
}

// --- Шапка рейла (бренд) ---------------------------------------------------

const coopShortName = computed<string>(
  () => info.vars?.short_abbr || info.coopname || 'Кооператив',
);
const coopMeta = computed<string | undefined>(() =>
  info.vars?.name && info.vars.name !== coopShortName.value
    ? info.vars.name
    : undefined,
);

// --- Footer: RailUserCard (canon .rail__usercard) --------------------------

// Мини-кошелёк показывает ТОЛЬКО паевой (`w.wal.share`) — сырой кошелёк без
// сворачивания с членской частью ЦК. Членские средства сюда не примешиваются
// (для них — карточка «Членский кошелёк» на странице кошелька).
const shareWallet = computed(() =>
  walletStore.user_wallets.find((w) => w.wallet_name === 'w.wal.share'),
);
const walletReady = computed<boolean>(() => walletStore.program_wallets.length > 0);

function splitAsset(asset?: string | null): { amount: string; symbol: string } {
  if (!asset) return { amount: '0,00', symbol: '' };
  const formatted = formatAsset2Digits(asset);
  const parts = formatted.split(' ');
  return { amount: parts[0] || '0,00', symbol: parts[1] || '' };
}

const walletAvail = computed(() => splitAsset(shareWallet.value?.available));
const walletBalance = computed<string>(() => walletAvail.value.amount);
const walletSymbol = computed<string>(
  () => walletAvail.value.symbol || info.symbols?.root_govern_symbol || 'RUB',
);
const walletLocked = computed<string | undefined>(() => {
  const split = splitAsset(shareWallet.value?.blocked);
  if (split.amount === '0,00' || split.amount === '0.00') return undefined;
  return split.amount;
});

const userName = computed<string>(() => {
  const acc = session.currentUserAccount?.private_account;
  if (!acc) return 'Пайщик';
  if (acc.type === Zeus.AccountType.organization) {
    const od = acc.organization_data as { short_name?: string; name?: string } | undefined;
    return od?.short_name || od?.name || 'Организация';
  }
  const id = acc.individual_data as
    | { first_name?: string; last_name?: string; middle_name?: string }
    | undefined;
  if (id?.first_name || id?.last_name) {
    return [id?.last_name, id?.first_name, id?.middle_name].filter(Boolean).join(' ').trim();
  }
  return session.username || 'Пайщик';
});
const userRoleLabel = computed<string>(() =>
  session.isChairman ? 'Председатель' : session.isMember ? 'Член совета' : 'Пайщик',
);

// --- Замок кошелька (canon v-model:collapsed) -----------------------------
//
// У входа по паролю свёрнутая карточка — это запертый кошелёк, а не «убрал с
// глаз»: ключ уходит из памяти, и вернуть его можно только PIN-кодом. Поэтому
// состояние карточки не хранится отдельно — его определяет сам кошелёк, и
// запирание по простою сворачивает карточку само, без чьей-либо помощи.
//
// У прежнего входа по ключу запирать нечего, и замок там остаётся тем же, чем
// была стрелка: свернуть и развернуть, с запоминанием выбора.

const STORAGE_KEY_USERCARD_COLLAPSED = 'monocoop-left-drawer-usercard-collapsed';
const manualCollapsed = ref<boolean>(false);
const askPinBeforeLock = ref<boolean>(false);

const userCardCollapsed = computed<boolean>({
  get: () => (session.isCoopIdSession ? session.walletLocked : manualCollapsed.value),
  set: (val) => {
    if (!session.isCoopIdSession) {
      manualCollapsed.value = val;
      localStorage.setItem(STORAGE_KEY_USERCARD_COLLAPSED, String(val));
      return;
    }
    if (val) {
      // PIN не задан — запирать бессмысленно: отпереть смог бы любой, кто сядет
      // за это устройство, потому что отпирание в таком случае прозрачное.
      // Поэтому сначала PIN, а запирание — сразу после его установки.
      if (!session.hasCustomPin) {
        askPinBeforeLock.value = true;
        return;
      }
      session.lockWalletNow();
      return;
    }
    // Отказ от ввода PIN оставляет кошелёк запертым — карточка так и не
    // раскроется, и это верно: раскрытая карточка обещала бы доступ, которого нет.
    void session.unlockWalletInteractive();
  },
});

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY_USERCARD_COLLAPSED);
  if (saved !== null) manualCollapsed.value = saved === 'true';
});

// --- Триггеры действий ----------------------------------------------------

function onDeposit(): void {
  // Открываем canon-диалог взноса через глобальный composable
  useDepositDialog().open();
}

async function onLogout(): Promise<void> {
  const { logout: doLogout } = useLogoutUser();
  try {
    await doLogout();
    void router.push({ name: 'signin' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    FailAlert('Ошибка при выходе: ' + msg);
  }
}
</script>

<style scoped>
.left-drawer-menu {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.left-drawer-menu__rail {
  height: 100%;
}
/* WorkspaceSwitcher переопределяет стандартный brand-row AppDrawer.
   Уменьшены боковые отступы — чтобы «Стол вычислительных ресурсов»
   влезал на три строки целиком. */
.left-drawer-menu__ws {
  margin: var(--p-1, 4px) var(--p-1, 4px) 0;
  width: calc(100% - var(--p-2, 8px));
}
/* Кнопки Deposit/Withdraw нужны нам только как держатели q-dialog'а
   (диалоги портятся в body независимо от родителя); сами кнопки прячем. */
.left-drawer-menu__hidden-dialogs {
  display: none;
}
/* Кнопка «Выйти из кабинета» из RailUserCard — урезаем нижний padding, чтобы версия
   шла сразу под ней без лишнего вертикального зазора. */
:deep(.rail__signout) {
  padding-bottom: var(--p-1, 4px);
}
/* Версия приложения — приглушённая подпись под карточкой пользователя.
   Рядом с ней кружок состояния узла: место видно с любого стола. */
.left-drawer-menu__version {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--p-1, 4px);
  text-align: center;
  padding: 0 var(--p-2, 8px) var(--p-1, 4px);
  font-size: 10px;
  color: var(--p-ink-3);
  user-select: none;
}
</style>
