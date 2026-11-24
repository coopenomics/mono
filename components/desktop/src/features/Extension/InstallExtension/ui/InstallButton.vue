<template lang="pug">
//- Последний шаг установки: запись расширения создаётся только здесь, сразу
//- включённой. До этой кнопки на сервере ничего нет — «Отмена» и «Назад» на
//- шаге настроек ничего не оставляют и удалять нечего
BaseButton(variant='primary', :block='block', :loading='isInstalling', @click='install')
  template(#icon-left)
    q-icon(name='check', size='18px')
  | {{ $t('extension.installButton.submit') }}
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useInstallExtension } from '../model';
import { BaseButton } from 'src/shared/ui/base';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { loadExtensionRoutes } from 'src/processes/init-installed-extensions';
import {
  extractGraphQLErrorMessages,
  FailAlert,
  SuccessAlert,
} from 'src/shared/api';
import { t } from 'src/shared/i18n';

interface Props {
  extensionName: string;
  config: any;
  myFormRef?: any;
  /** На всю ширину колонки */
  block?: boolean;
}

const props = withDefaults(defineProps<Props>(), { block: false });

const router = useRouter();
const desktop = useDesktopStore();
const isInstalling = ref(false);

const validateForm = async () => {
  return await props.myFormRef?.value?.validate();
};

const install = async () => {
  const is_valid = await validateForm();
  if (is_valid === false) return;

  const { installExtension } = useInstallExtension();
  isInstalling.value = true;

  try {
    await installExtension(props.extensionName, true, props.config);

    // Сначала загружаем обновленный desktop с сервера
    await desktop.loadDesktop();

    // Затем динамически загружаем маршруты для установленного расширения
    await loadExtensionRoutes(props.extensionName, router);

    // Редирект на первую ДОСТУПНУЮ пользователю страницу расширения (канон
    // grants): для расширений с онбордингом это страница подключения ЦПП, иначе —
    // первый видимый стол/страница. Так администратор не попадает на ещё
    // закрытый дефолтный роут (permissionDenied).
    const target = desktop.firstAccessibleRoute(props.extensionName);
    if (target) {
      const coopname = useSystemStore().info?.coopname;
      router.push(coopname ? { name: target.name, params: { coopname } } : { name: target.name });
    } else {
      router.push({ name: 'one-extension' });
    }
    SuccessAlert(t('extension.installButton.installedSuccess'));
  } catch (e: unknown) {
    FailAlert(t('extension.installButton.installError', { errorMessage: extractGraphQLErrorMessages(e) }));
  } finally {
    isInstalling.value = false;
  }
};
</script>
