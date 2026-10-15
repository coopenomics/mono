<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import Sidebar from '@/components/Sidebar.vue';

const MOBILE_BREAKPOINT = 900;

const isMobile = ref(false);

// Свёрнутое меню стандартов освобождает место под схему и текст на узком экране.
const SIDEBAR_KEY = 'standards.sidebarCollapsed';
const sidebarCollapsed = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_KEY) === '1',
);
function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  try {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0');
  } catch {
    // приватный режим — состояние живёт до перезагрузки
  }
}

function updateIsMobile(): void {
  if (typeof window === 'undefined') return;
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
}

onMounted(() => {
  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile);
});
</script>

<template>
  <div v-if="isMobile" class="mobile-stub">
    <div class="mobile-stub__box">
      <h1>Только для десктопа</h1>
      <p>
        Кооперативные стандарты рассчитаны на широкие экраны — схема
        процесса не помещается на мобильных устройствах.
        Откройте сайт с компьютера или планшета.
      </p>
    </div>
  </div>

  <div v-else class="app-shell" :class="{ 'app-shell--collapsed': sidebarCollapsed }">
    <aside v-show="!sidebarCollapsed" class="app-sidebar">
      <Sidebar @collapse="toggleSidebar" />
    </aside>
    <main class="app-main">
      <!-- Снаружи кнопка нужна только у свёрнутого меню; у открытого она внутри меню. -->
      <button
        v-if="sidebarCollapsed"
        type="button"
        class="sidebar-toggle"
        title="Показать список стандартов"
        @click="toggleSidebar"
      >›</button>
      <router-view />
    </main>
  </div>
</template>
