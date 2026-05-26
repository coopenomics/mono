<template lang="pug">
q-btn.full-width(color='teal', @click='install', :loading='isInstalling') включить
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useInstallExtension } from '../model';
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
  myFormRef?: any;
}

const props = defineProps<Props>();

const router = useRouter();
const desktop = useDesktopStore();
const isInstalling = ref(false);

const validateForm = async () => {
  return await props.myFormRef?.value?.validate();
};

const install = async () => {
  console.log('install', props.extensionName, props.config, props.myFormRef)
  const is_valid = await validateForm();
  console.log('is_valid', is_valid)
  if (is_valid === false) return;

  const { installExtension } = useInstallExtension();
  isInstalling.value = true;

  try {
    console.log('🔧 [InstallExtension] Starting extension installation:', props.extensionName);
    await installExtension(props.extensionName, true, props.config);
    console.log('🔧 [InstallExtension] Extension installed on backend');

    // Сначала загружаем обновленный desktop с сервера
    console.log('🔧 [InstallExtension] Loading desktop from server...');
    await desktop.loadDesktop();
    console.log('🔧 [InstallExtension] Desktop loaded, current workspaces:', desktop.currentDesktop?.workspaces?.map(ws => ({ name: ws.name, title: ws.title })));

    // Затем динамически загружаем маршруты для установленного расширения
    console.log('🔧 [InstallExtension] Loading extension routes...');
    const configs = await loadExtensionRoutes(props.extensionName, router);
    console.log('🔧 [InstallExtension] Extension routes loaded');

    // Редирект на «домашнюю» страницу расширения (defaultRoute первого стола).
    // Для расширений с онбордингом первый стол — стол подключения, и админа
    // сразу ведёт на страницу принятия ЦПП, чтобы он не терялся после включения.
    const home = configs?.[0]?.defaultRoute;
    if (home) {
      const coopname = useSystemStore().info?.coopname;
      router.push(coopname ? { name: home, params: { coopname } } : { name: home });
    } else {
      router.push({ name: 'one-extension' });
    }
    SuccessAlert('Расширение установлено');
  } catch (e: unknown) {
    FailAlert(`Ошибка установки расширения: ${extractGraphQLErrorMessages(e)}`);
  } finally {
    isInstalling.value = false;
  }
};
</script>
