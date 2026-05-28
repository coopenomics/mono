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

      // Глобальный CmdkMenu на уровне всего приложения
    CmdkMenu

</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Header } from 'src/widgets/Header/CommonHeader';
import { LeftDrawerMenu } from 'src/widgets/Desktop/LeftDrawerMenu';
import { CmdkMenu } from 'src/widgets/Desktop/CmdkMenu';
import { ContactsFooter } from 'src/shared/ui/Footer';

import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useDefaultLayoutLogic } from './useDefaultLayoutLogic';
import { usePWAThemeColor } from 'src/shared/lib/composables/usePWAThemeColor';
import { useRightDrawerReader } from 'src/shared/hooks/useRightDrawer';
import { WindowLoader } from 'src/shared/ui/Loader';
import { Zeus } from '@coopenomics/sdk';
const desktop = useDesktopStore();
const system = useSystemStore();
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
