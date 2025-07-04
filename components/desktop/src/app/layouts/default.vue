<template lang="pug">
q-layout(view='lHh LpR fff')
  Header(:showDrawer='showDrawer', @toggle-left-drawer='toggleLeftDrawer')

  q-drawer(
    v-if='showDrawer && loggedIn',
    v-model='leftDrawerOpen',
    side='left',
    bordered,
    :width='200'
  )
    LeftDrawerMenu

  q-footer(v-if='!loggedIn', :class='headerClass', bordered)
    ContactsFooter(:text='footerText')

  q-page-container
    q-page
      .absolute-full.flex.flex-center.z-top(v-if='desktop.isWorkspaceChanging')
        Loader

      router-view(v-else)
</template>

<script setup lang="ts">
import { Header } from 'src/widgets/Header/CommonHeader';
import { LeftDrawerMenu } from 'src/widgets/Desktop/LeftDrawerMenu';
import { ContactsFooter } from 'src/shared/ui/Footer';
import { Loader } from 'src/shared/ui/Loader';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useDefaultLayoutLogic } from './useDefaultLayoutLogic';
import { usePWAThemeColor } from 'src/shared/lib/composables/usePWAThemeColor';

const desktop = useDesktopStore();

// Настраиваем автоматическое обновление PWA theme-color
usePWAThemeColor();

const {
  leftDrawerOpen,
  showDrawer,
  headerClass,
  footerText,
  loggedIn,
  toggleLeftDrawer,
} = useDefaultLayoutLogic();
</script>

<style lang="scss">
.drawer-right {
  border-left: 1px solid #00800038 !important;
}

.drawer-left {
  border-right: 1px solid #00800038 !important;
}
</style>
