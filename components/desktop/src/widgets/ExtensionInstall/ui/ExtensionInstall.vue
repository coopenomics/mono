<template lang="pug">
.extension-install
  q-form(ref='formRef')
    BaseCard(v-if='schema && !isEmpty', title='Настройки')
      ZodForm(
        :schema='schema',
        :model-value='config',
        :install-mode='true',
        @update:model-value='$emit("update:config", $event)'
      )
    BaseCard(v-else, title='Установка расширения')
      p.extension-install__note Расширение не требует дополнительной настройки. Нажмите «Включить» для завершения установки и активации расширения.
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { ZodForm } from 'src/shared/ui/ZodForm';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { isExtensionSchemaEmpty } from 'src/shared/lib/utils';
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
</script>

<style scoped lang="scss">
.extension-install {
  max-width: 1000px;
}
.extension-install__note {
  margin: 0;
  font-size: var(--p-fs-body);
  line-height: 1.6;
  color: var(--p-ink-2);
}
</style>
