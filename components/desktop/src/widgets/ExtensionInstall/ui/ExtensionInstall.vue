<template lang="pug">
//- Шаг установки — отдельный экран, а не та же страница со сменой кнопки:
//- заголовок «Установка …», что от пользователя требуется, настройки и под
//- ними «Завершить установку». Запись расширения создаётся только этой
//- кнопкой, поэтому «Отмена» просто возвращает на страницу расширения.
.extension-install
  .extension-install__heading
    h2.extension-install__title {{ $t('extensionInstall.extensionInstall.stepTitle', { title: extensionTitle }) }}
    p.extension-install__hint {{ $t('extensionInstall.extensionInstall.stepHint') }}
  q-form(ref='formRef')
    BaseCard(v-if='schema && !isEmpty', :title='$t("extensionInstall.extensionInstall.settingsTitle")')
      ZodForm(
        :schema='schema',
        :model-value='config',
        :install-mode='true',
        @update:model-value='$emit("update:config", $event)'
      )
    BaseCard(v-else, :title='$t("extensionInstall.extensionInstall.settingsTitle")')
      p.extension-install__note {{ $t('extensionInstall.extensionInstall.noSettingsNote') }}
  .extension-install__actions(v-if='extensionName')
    InstallButton(
      :extension-name='extensionName',
      :config='config',
      :my-form-ref='formRef'
    )
    CancelButton(:block='false')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { ZodForm } from 'src/shared/ui/ZodForm';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { isExtensionSchemaEmpty } from 'src/shared/lib/utils';
import { useExtensionStore } from 'src/entities/Extension/model';
import { InstallButton } from 'src/features/Extension/InstallExtension';
import { CancelButton } from 'src/features/Extension/UpdateExtension';
import type { IExtensionConfigSchema } from 'src/entities/Extension/model';

type ExtensionInstallConfig = Record<string, unknown>;
type ExtensionInstallFormRef = {
  value: Element | ComponentPublicInstance | null | undefined;
};

interface Props {
  extensionName?: string;
  schema?: IExtensionConfigSchema;
  config: ExtensionInstallConfig;
  formRef?: ExtensionInstallFormRef;
}

const props = defineProps<Props>();

const isEmpty = computed(() => isExtensionSchemaEmpty(props.schema));

// Название для заголовка шага — из уже загруженного каталога, без лишнего запроса
const extensionStore = useExtensionStore();
const extensionTitle = computed(
  () =>
    extensionStore.extensions.find((e) => e.name === props.extensionName)?.title ||
    props.extensionName ||
    '',
);
</script>

<style scoped lang="scss">
.extension-install {
  max-width: 1000px;
}
.extension-install__heading {
  margin-bottom: var(--p-5, 20px);
}
.extension-install__title {
  margin: 0;
  font-size: var(--p-fs-h1, 24px);
  font-weight: 700;
  letter-spacing: var(--p-ls-h1, -0.01em);
  color: var(--p-ink);
}
.extension-install__hint {
  margin: var(--p-2, 8px) 0 0;
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-body);
  color: var(--p-ink-2);
}
// Действия шага — под настройками, на телефоне в столбик
.extension-install__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2, 8px);
  margin-top: var(--p-5, 20px);
  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
  }
}
.extension-install__note {
  margin: 0;
  font-size: var(--p-fs-body);
  line-height: 1.6;
  color: var(--p-ink-2);
}
</style>
