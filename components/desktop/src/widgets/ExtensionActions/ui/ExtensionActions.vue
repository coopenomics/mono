<template lang="pug">
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

  //- Главная, ещё не установлено: кнопка «установить» + список столов.
  template(v-if='isMain && !extension.is_installed')
    q-btn.full-width(
      color='primary',
      unelevated,
      no-caps,
      @click='router.push({ name: "extension-install" })'
    ) Установить
    DesktopsList(:desktops='extension.desktops')

  //- Шаг установки.
  template(v-if='isInstall && !extension.is_installed')
    InstallButton(
      :extension-name='extension?.name',
      :config='config',
      :my-form-ref='formRef'
    )
    DesktopsList(:desktops='extension.desktops')

  //- Главная, установлено: настройки / вкл-выкл / удаление.
  template(v-if='isMain && extension.is_installed')
    SettingsButton
    p.ext-actions__note(v-if='extension.is_builtin') Минимальное расширение
    .ext-actions__toggle(v-else)
      DisableButton(
        v-if='extension.enabled',
        :extension='extension',
        :disabled='extension.is_builtin'
      )
      EnableButton(
        v-if='!extension.enabled',
        :extension-name='extension.name',
        :config='extension.config',
        :disabled='extension.is_builtin'
      )
      UninstallButton(
        :extension-name='extension.name',
        :disabled='extension.is_builtin'
      )
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
import { InstallButton } from 'src/features/Extension/InstallExtension';
import { EnableButton } from 'src/features/Extension/EnableExtension';
import { DisableButton } from 'src/features/Extension/DisableExtension';
import { DesktopsList } from 'src/widgets/ExtensionDesktopsList';

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

.ext-actions__toggle {
  display: flex;
  gap: var(--p-2, 8px);
}
// Кнопки вкл/выкл и удаления делят строку поровну (full-width внутри).
.ext-actions__toggle > * {
  flex: 1;
  min-width: 0;
}

.ext-actions__note {
  margin: 0;
  text-align: center;
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
</style>
