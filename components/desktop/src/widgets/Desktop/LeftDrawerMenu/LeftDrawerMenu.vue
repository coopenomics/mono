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
        :balance-route='{ name: "wallet", params: { coopname: info.coopname } }',
        primary-action-label='Пополнить',
        show-signout,
        signout-label='Выйти',
        @primary-action='onDeposit',
        @signout='onLogout'
      )

  //- Невидимые носители canon-диалогов: рендерятся в q-portal,
  //- открываются глобальными ref'ами через useDepositDialog().open() /
  //- useWithdrawDialog().open() из onDeposit/onWithdraw выше.
  .left-drawer-menu__hidden-dialogs(aria-hidden='true')
    DepositButton(:micro='true')
    WithdrawButton(:micro='true')
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useWalletStore } from 'src/entities/Wallet';
import { useCmdkMenuStore } from 'src/entities/CmdkMenu/model';
import { useActionsStore } from 'src/shared/lib/stores/actions.store';
import { useLogoutUser } from 'src/features/User/Logout';
import { useDepositDialog, DepositButton } from 'src/features/Wallet/DepositToWallet';
import { WithdrawButton } from 'src/features/Wallet/WithdrawFromWallet';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { AppDrawer } from 'src/shared/ui/layout/AppDrawer';
import type { RailItem } from 'src/shared/ui/layout/AppDrawer';
import { RailUserCard } from 'src/shared/ui/domain/RailUserCard';
import { WorkspaceSwitcher } from 'src/widgets/Desktop/WorkspaceSwitcher';

const router = useRouter();
const desktop = useDesktopStore();
const session = useSessionStore();
const systemStore = useSystemStore();
const { info } = systemStore;
const walletStore = useWalletStore();
const actionsStore = useActionsStore();
const cmdkStore = useCmdkMenuStore();

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
  return (desktop.activeSecondLevelRoutes as RouteRecordRaw[]).filter((r) => {
    const meta = (r.meta ?? {}) as MenuMeta;
    const rolesOk =
      !meta.roles ||
      meta.roles.length === 0 ||
      meta.roles.includes(ctx.userRole);
    const condOk = evalCondition(meta.conditions, ctx);
    const visibleOk = !meta.hidden;
    return rolesOk && condOk && visibleOk;
  });
});

const railItems = computed<RailItem[]>(() =>
  filteredRoutes.value.map((r) => {
    const meta = (r.meta ?? {}) as MenuMeta;
    return {
      key: String(r.name),
      label: meta.title ?? String(r.name),
      icon: meta.icon,
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
    if (r.name === 'projects-list' && currentName.startsWith('project-')) {
      return String(r.name);
    }
  }
  return undefined;
});

// --- Навигация -------------------------------------------------------------

function onSelect(item: RailItem): void {
  const route = filteredRoutes.value.find((r) => String(r.name) === item.key);
  if (!route) return;
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
  // Открываем глобальную панель поиска через её собственный store.
  void cmdkStore.openDialog();
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

const mainWallet = computed(() =>
  walletStore.program_wallets.find((w) => w.program_type === Zeus.ProgramType.MAIN),
);
const walletReady = computed<boolean>(() => walletStore.program_wallets.length > 0);

function splitAsset(asset?: string | null): { amount: string; symbol: string } {
  if (!asset) return { amount: '0,00', symbol: '' };
  const formatted = formatAsset2Digits(asset);
  const parts = formatted.split(' ');
  return { amount: parts[0] || '0,00', symbol: parts[1] || '' };
}

const walletAvail = computed(() => splitAsset(mainWallet.value?.available));
const walletBalance = computed<string>(() => walletAvail.value.amount);
const walletSymbol = computed<string>(
  () => walletAvail.value.symbol || info.symbols?.root_govern_symbol || 'RUB',
);
const walletLocked = computed<string | undefined>(() => {
  const split = splitAsset(mainWallet.value?.blocked);
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

// --- Свёртка кошелька (canon v-model:collapsed) ---------------------------

const STORAGE_KEY_USERCARD_COLLAPSED = 'monocoop-left-drawer-usercard-collapsed';
const userCardCollapsed = ref<boolean>(false);

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY_USERCARD_COLLAPSED);
  if (saved !== null) userCardCollapsed.value = saved === 'true';
});

watch(userCardCollapsed, (val) => {
  localStorage.setItem(STORAGE_KEY_USERCARD_COLLAPSED, String(val));
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
</style>
