<template lang="pug">
.left-drawer-menu
  .menu-content
    WorkspaceMenu
    SecondLevelMenuList

  .logout-section
    LogoutButton
</template>

<script setup lang="ts">
import { SecondLevelMenuList } from '../SecondLevelMenuList';
import { WorkspaceMenu } from '../WorkspaceMenu';
import { LogoutButton } from 'src/features/User/Logout';
</script>

<style scoped>
.left-drawer-menu {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.menu-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.logout-section {
  margin-top: auto;
  padding-top: 8px;
}

body.body--dark .logout-section {
  border-top-color: rgba(255, 255, 255, 0.12);
}
</style>
