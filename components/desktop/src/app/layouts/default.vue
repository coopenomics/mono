<template lang="pug">
q-layout(view='lHh LpR fff')
  Header(:showDrawer='showDrawer', @toggle-left-drawer='toggleLeftDrawer')

  //- Левый дровер: .rail внутри LeftDrawerMenu сам рисует canon-границу
  //- (border-right из var(--p-line)) — q-drawer bordered убран, чтобы
  //- не было двойной линии.
  q-drawer.app-left-drawer(
    v-if='showDrawer && loggedIn',
    v-model='leftDrawerOpen',
    side='left',
    persistent,
    :width='248'
  )
    LeftDrawerMenu

  // Кнопка открытия drawer (снаружи)
  q-btn.fixed-top-right(
    v-if='rightDrawerActions.length > 0 && !rightDrawerOpen',
    :style='buttonStyle',
    dense,

    flat
    icon='fas fa-chevron-left',
    @click='toggleRightDrawer'
  )

  q-drawer.drawer-right(
    v-if='rightDrawerActions.length > 0',
    v-model='rightDrawerOpen',
    side='right',
    bordered,
    :width='250'
  )
    // Кнопка закрытия drawer (внутри)
    .div
      q-btn(
        dense,
        :style='buttonStyle',
        flat,
        icon='fas fa-chevron-right',
        @click='toggleRightDrawer'
      )

    // Инжектированные компоненты действий
    template(v-for='action in rightDrawerActions', :key='action.id')
      component(:is='action.component', v-bind='action.props')

  q-footer(v-if='!loggedIn && system.info.system_status !== Zeus.SystemStatus.install && system.info.system_status !== Zeus.SystemStatus.initialized', :class='headerClass', bordered)
    ContactsFooter(:text='footerText')

  q-page-container
    q-page
      WindowLoader(v-if='desktop?.isWorkspaceChanging')
      router-view(v-else)

  //- Глобальная палитра команд: ⌘K / Ctrl+K открывает её для поиска
  //- столов и страниц. Видимость списка отражает фильтр меню второго уровня.
  CommandPalette(
    v-model='paletteOpen',
    :workspaces='paletteWorkspaces',
    @select-workspace='onSelectWorkspace',
    @select-page='onSelectPage'
  )
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { storeToRefs } from 'pinia';
import { Header } from 'src/widgets/Header/CommonHeader';
import { LeftDrawerMenu } from 'src/widgets/Desktop/LeftDrawerMenu';
import { CommandPalette } from 'src/shared/ui/domain/CommandPalette';
import type { CommandPaletteWorkspace } from 'src/shared/ui/domain/CommandPalette';
import { ContactsFooter } from 'src/shared/ui/Footer';

import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useCommandPaletteStore } from 'src/entities/CommandPalette/model';
import { useDefaultLayoutLogic } from './useDefaultLayoutLogic';
import { usePWAThemeColor } from 'src/shared/lib/composables/usePWAThemeColor';
import { useRightDrawerReader } from 'src/shared/hooks/useRightDrawer';
import { WindowLoader } from 'src/shared/ui/Loader';
import { Zeus } from '@coopenomics/sdk';

const router = useRouter();
const desktop = useDesktopStore();
const system = useSystemStore();
const session = useSessionStore();
const palette = useCommandPaletteStore();
const { isOpen: paletteOpen } = storeToRefs(palette);
const { rightDrawerActions } = useRightDrawerReader();

// Настраиваем автоматическое обновление PWA theme-color
usePWAThemeColor();

const {
  leftDrawerOpen,
  rightDrawerOpen,
  showDrawer,
  headerClass,
  footerText,
  loggedIn,
  isMobile,
  toggleLeftDrawer,
  toggleRightDrawer,
} = useDefaultLayoutLogic();

const buttonStyle = computed(() => ({
  width: isMobile.value ? '45px' : '56px',
  height: isMobile.value ? '30px' : '50px'
}));

// --- CommandPalette: адаптер из DesktopStore.workspaceMenus -----------------

interface RouteMetaShape {
  title?: string;
  icon?: string;
  roles?: string[];
  hidden?: boolean;
  conditions?: string;
}

const userRole = computed<'chairman' | 'member' | 'user'>(() =>
  session.isChairman ? 'chairman' : session.isMember ? 'member' : 'user',
);

// Контекст для meta.conditions — те же ключи, что и в LeftDrawerMenu
// (chairman/install.ts использует isOnboardingHidden, participant/soviet —
// isCoop + coopname).
const filterContext = computed(() => {
  const acc = session.currentUserAccount?.private_account;
  const isCoop =
    acc?.type === Zeus.AccountType.organization &&
    !!acc.organization_data &&
    'type' in acc.organization_data &&
    (acc.organization_data as { type: string }).type.toUpperCase() ===
      Zeus.OrganizationType.COOP;
  return {
    isCoop: Boolean(isCoop),
    userRole: userRole.value,
    coopname: system.info.coopname,
    isOnboardingHidden:
      typeof localStorage !== 'undefined' &&
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

const paletteWorkspaces = computed<CommandPaletteWorkspace[]>(() => {
  const ctx = filterContext.value;
  return desktop.workspaceMenus.map((ws) => {
    const children = (ws.mainRoute?.children ?? []) as RouteRecordRaw[];
    const pages = children
      .filter((r) => {
        const meta = (r.meta ?? {}) as RouteMetaShape;
        if (meta.hidden) return false;
        if (!evalCondition(meta.conditions, ctx)) return false;
        if (meta.roles && meta.roles.length && !meta.roles.includes(userRole.value)) {
          return false;
        }
        return true;
      })
      .map((r) => {
        const meta = (r.meta ?? {}) as RouteMetaShape;
        return {
          name: String(r.name),
          title: meta.title ?? String(r.name),
          icon: meta.icon,
        };
      });
    return {
      name: ws.workspaceName,
      title: ws.title,
      icon: ws.icon,
      isActive: ws.workspaceName === desktop.activeWorkspaceName,
      pages,
    };
  });
});

function onSelectWorkspace(workspaceName: string): void {
  palette.close();
  desktop.selectWorkspace(workspaceName);
  desktop.closeLeftDrawerOnMobile();
  const ws = desktop.workspaceMenus.find((m) => m.workspaceName === workspaceName);
  if (ws?.mainRoute?.name) {
    void router.push({
      name: ws.mainRoute.name as string,
      params: { coopname: system.info.coopname },
    });
  }
}

function onSelectPage(workspaceName: string, pageName: string): void {
  palette.close();
  if (workspaceName !== desktop.activeWorkspaceName) {
    desktop.selectWorkspace(workspaceName);
  }
  desktop.closeLeftDrawerOnMobile();
  void router.push({
    name: pageName,
    params: { coopname: system.info.coopname },
  });
}

// --- Глобальный hotkey ⌘K / Ctrl+K ----------------------------------------

function onGlobalKeyDown(event: KeyboardEvent): void {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const mod = isMac ? event.metaKey : event.ctrlKey;
  if (mod && (event.key === 'k' || event.key === 'K')) {
    event.preventDefault();
    palette.toggle();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
});
</script>

<style lang="scss">
/* Левый дровер фиксированный — горизонтального скролла быть не должно.
   У .rail есть собственный border-right (1px), который при content-box даёт
   ~1px overflow внутри контента дровера и порождает паразитный горизонтальный
   скроллбар; трекпадом его можно «оттянуть», обнажая правую границу.
   Гасим overflow-x и эластичное оттягивание, а .rail приводим к border-box. */
.app-left-drawer {
  .q-drawer__content {
    overflow-x: hidden;
    overscroll-behavior-x: contain;
  }
  .rail {
    width: 100%;
    box-sizing: border-box;
  }
}

.drawer-right {
  border-left: 1px solid var(--p-line) !important;
}

.fixed-top-right {
  position: fixed !important;
  top: var(--p-topbar-h);
  right: 0;
  z-index: 10;
}
</style>
