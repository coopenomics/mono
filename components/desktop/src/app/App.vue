<template lang="pug">
div.breable-text(v-if='isLoaded')
  router-view
  RequireAgreements
  SelectBranchOverlay
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Cookies, LocalStorage } from 'quasar';
import { FailAlert } from 'src/shared/api/alerts';
import { handleException } from 'src/shared/api';
import { RequireAgreements } from 'src/widgets/RequireAgreements';
import { SelectBranchOverlay } from 'src/features/Branch/SelectBranch';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopHealthWatcherProcess } from 'src/processes/watch-desktop-health';
import 'src/shared/ui/CardStyles/index.scss';

const { info } = useSystemStore();
const route = useRoute();
const isLoaded = ref(false);

// запускаем процесс мониторинга "технического обслуживания"
useDesktopHealthWatcherProcess();

onMounted(() => {
  try {
    removeLoader();
    isLoaded.value = true;

    const ref = Cookies.get('referer') || String(route.query.r || '');
    if (ref) {
      LocalStorage.setItem(`${info.coopname}:referer`, ref);
    }
  } catch (e) {
    console.error(e);
    handleException(e);
    isLoaded.value = true;
    removeLoader();
  }
});

function removeLoader() {
  const loaderContainer = document.querySelector('.loader-container');
  if (loaderContainer) {
    loaderContainer.remove();
  } else {
    FailAlert('Возникла ошибка при загрузке сайта :(');
  }
}
</script>
<style>
.q-loading__backdrop {
  /* стиль полного оверлея технического обслуживания */
  opacity: 1 !important;
}
</style>
