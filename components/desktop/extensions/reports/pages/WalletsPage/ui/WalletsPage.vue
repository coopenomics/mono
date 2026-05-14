<template lang="pug">
.column.flex-1.min-h-0.min-w-0.no-wrap
  router-view
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted } from 'vue'
import { useHeaderActions } from 'src/shared/hooks/useHeaderActions'
import RouteMenuButton from 'src/shared/ui/RouteMenuButton/RouteMenuButton.vue'

// Shell-страница «Кошельки»: инжектит две кнопки в шапку сайта
// (Кооператив / Пайщики), переключает через именованные дочерние маршруты.
// Паттерн один-в-один как DocumentsPage.
const { registerAction, clearActions } = useHeaderActions()

const menuButtons = computed(() => [
  {
    id: 'reports-wallets-coop-menu',
    component: markRaw(RouteMenuButton),
    props: {
      routeName: 'reports-wallets-coop',
      label: 'Кооператив',
    },
    order: 1,
  },
  {
    id: 'reports-wallets-participants-menu',
    component: markRaw(RouteMenuButton),
    props: {
      routeName: 'reports-wallets-participants',
      label: 'Пайщики',
    },
    order: 2,
  },
])

onMounted(() => {
  menuButtons.value.forEach((b) => registerAction(b))
})

onBeforeUnmount(() => {
  clearActions()
})
</script>
