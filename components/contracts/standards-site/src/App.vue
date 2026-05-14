<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import Sidebar from '@/components/Sidebar.vue';

const MOBILE_BREAKPOINT = 900;

const isMobile = ref(false);

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
        Реестр кооперативных стандартов рассчитан на широкие экраны —
        BPMN-граф процесса не помещается на мобильных устройствах.
        Откройте сайт с компьютера или планшета.
      </p>
    </div>
  </div>

  <div v-else class="app-shell">
    <aside class="app-sidebar">
      <Sidebar />
    </aside>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>
