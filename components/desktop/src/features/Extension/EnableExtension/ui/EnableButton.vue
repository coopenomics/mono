<template lang="pug">
q-btn.full-width(
  size='sm',
  @click='enable',
  flat,
  :disabled='disabled',
  :loading='isEnabling'
)
  q-icon.text-grey(name='fa-solid fa-toggle-off')
  span.q-ml-xs отключено
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useEnableExtension } from '../model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { loadExtensionRoutes } from 'src/processes/init-installed-extensions';
import {
  extractGraphQLErrorMessages,
  FailAlert,
  SuccessAlert,
} from 'src/shared/api';

interface Props {
  extensionName: string;
  config: any;
  disabled?: boolean;
}

const props = defineProps<Props>();

const router = useRouter();
const desktop = useDesktopStore();
const isEnabling = ref(false);

const enable = async () => {
  const { enableExtension } = useEnableExtension();
  isEnabling.value = true;
  console.log('enable', props.extensionName, props.config)
  try {
    await enableExtension(props.extensionName, props.config);
    // Сначала перезагружаем desktop с сервера, чтобы включённое расширение появилось
    await desktop.loadDesktop();
    // Затем динамически загружаем маршруты для включенного расширения
    await loadExtensionRoutes(props.extensionName, router);
    // Редирект на первую ДОСТУПНУЮ страницу расширения (канон grants): для
    // расширений с онбордингом — страница подключения ЦПП, иначе первый
    // видимый стол. См. DesktopStore.firstAccessibleRoute.
    const target = desktop.firstAccessibleRoute(props.extensionName);
    if (target) {
      const coopname = useSystemStore().info?.coopname;
      router.push(coopname ? { name: target.name, params: { coopname } } : { name: target.name });
    }
    SuccessAlert('Расширение обновлено');
  } catch (e: any) {
    FailAlert(`Ошибка включения расширения: ${extractGraphQLErrorMessages(e)}`);
  } finally {
    isEnabling.value = false;
  }
};
</script>
