<template lang="pug">
//- Левая колонка страницы расширения. Три состояния различаются видом, а не
//- одной сменой подписи на том же месте (замечание владельца 24.11.2026):
//-   не установлено — «Установить»;
//-   шаг установки — метка «Установка не завершена», кнопка «Завершить
//-     установку» стоит под настройками справа (ExtensionInstall);
//-   установлено — метка состояния и команды «Настройки», «Включить» или
//-     «Выключить», «Удалить».
.ext-actions
  //- Режим настроек: сохранить + отменить (вернуться без сохранения).
  template(v-if='isSettings')
    SaveButton(
      :extension-name='extension?.name',
      :extension-enabled='extension?.enabled ?? false',
      :config='config',
      :my-form-ref='formRef',
      :is-empty='isEmpty ?? false'
    )
    CancelButton

  //- Главная, ещё не установлено: кнопка «Установить» открывает шаг настроек.
  template(v-if='isMain && !extension.is_installed')
    BaseButton(variant='primary', block, @click='router.push({ name: "extension-install" })')
      template(#icon-left)
        q-icon(name='download', size='18px')
      | {{ $t('extensionActions.extensionActions.installButton') }}
    DesktopsList(:desktops='extension.desktops')

  //- Шаг установки: на сервере ещё ничего нет, кнопки — под настройками.
  template(v-if='isInstall && !extension.is_installed')
    .ext-actions__state
      BaseBadge(variant='info') {{ $t('extensionActions.extensionActions.installPending') }}
    DesktopsList(:desktops='extension.desktops')

  //- Главная, установлено: состояние, настройки, вкл-выкл, удаление.
  template(v-if='isMain && extension.is_installed')
    .ext-actions__state
      BaseBadge(:variant='extension.enabled ? "pos" : "warn"')
        | {{ extension.enabled ? $t('extensionActions.extensionActions.statusEnabled') : $t('extensionActions.extensionActions.statusDisabled') }}
      .ext-actions__hint(v-if='!extension.enabled') {{ $t('extensionActions.extensionActions.disabledHint') }}
    //- Выключенное расширение: главное действие — включить
    EnableButton(
      v-if='!extension.enabled',
      :extension-name='extension.name',
      :config='extension.config'
    )
    SettingsButton
    DisableButton(v-if='extension.enabled', :extension='extension')
    UninstallButton(:extension-name='extension.name', :extension-title='extension.title')
    DesktopsList(:desktops='extension.desktops')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { IExtension } from 'src/entities/Extension/model/types';
import {
  SaveButton,
  SettingsButton,
  CancelButton,
} from 'src/features/Extension/UpdateExtension';
import { UninstallButton } from 'src/features/Extension/UninstallExtension';
import { EnableButton } from 'src/features/Extension/EnableExtension';
import { DisableButton } from 'src/features/Extension/DisableExtension';
import { DesktopsList } from 'src/widgets/ExtensionDesktopsList';
import { BaseBadge, BaseButton } from 'src/shared/ui/base';

interface Props {
  extension: IExtension;
  mode: 'main' | 'install' | 'settings';
  config?: any;
  formRef?: any;
  isEmpty?: boolean;
}

const props = defineProps<Props>();
const router = useRouter();

const isMain = computed(() => props.mode === 'main');
const isInstall = computed(() => props.mode === 'install');
const isSettings = computed(() => props.mode === 'settings');
</script>

<style scoped lang="scss">
.ext-actions {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

// Метка состояния — по центру колонки, под логотипом
.ext-actions__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-1, 4px);
  text-align: center;
}

.ext-actions__hint {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
}
</style>
