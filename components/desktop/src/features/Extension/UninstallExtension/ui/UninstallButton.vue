<template lang="pug">
//- Удаление стирает запись расширения вместе с настройками — только после
//- подтверждения; выключение настройки сохраняет
BaseButton(
  variant='ghost',
  block,
  :disabled='disabled',
  :loading='isUninstalling',
  @click='uninstall'
)
  template(#icon-left)
    q-icon(name='delete', size='18px')
  | {{ $t('extension.uninstallButton.action') }}
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUninstallExtension } from '../model';
import { BaseButton } from 'src/shared/ui/base';
import { useConfirm } from 'src/shared/lib/composables';
import { useDesktopStore } from 'src/entities/Desktop/model';
import {
  extractGraphQLErrorMessages,
  FailAlert,
  SuccessAlert,
} from 'src/shared/api';
import { t } from 'src/shared/i18n';

interface Props {
  extensionName: string;
  /** Название для вопроса подтверждения; без него — техническое имя */
  extensionTitle?: string;
  disabled?: boolean;
}

const props = defineProps<Props>();

const router = useRouter();
const desktop = useDesktopStore();
const isUninstalling = ref(false);
const { confirm } = useConfirm();

const uninstall = async () => {
  const confirmed = await confirm({
    title: t('extension.uninstallButton.confirmTitle', {
      title: props.extensionTitle || props.extensionName,
    }),
    message: t('extension.uninstallButton.confirmMessage'),
    note: t('extension.uninstallButton.confirmNote'),
    confirmLabel: t('extension.uninstallButton.confirmLabel'),
    danger: true,
  });
  if (!confirmed) return;

  const { uninstallExtension } = useUninstallExtension();
  isUninstalling.value = true;

  try {
    await uninstallExtension(props.extensionName);
    router.push({ name: 'one-extension' });
    desktop.loadDesktop();
    SuccessAlert(t('extension.uninstallButton.uninstalledSuccess'));
  } catch (e: any) {
    FailAlert(t('extension.uninstallButton.uninstallError', { errorMessage: extractGraphQLErrorMessages(e) }));
  } finally {
    isUninstalling.value = false;
  }
};
</script>
