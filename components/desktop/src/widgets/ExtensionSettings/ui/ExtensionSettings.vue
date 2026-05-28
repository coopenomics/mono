<template lang="pug">
.extension-settings
  q-form(ref='formRef')
    EmptyState(
      v-if='isEmpty',
      title='Нет настроек',
      body='Расширение не предоставило настроек для изменения.'
    )
      template(#icon)
        q-icon(name='settings', size='48px')

    BaseCard(v-else)
      ZodForm(
        :schema='schema',
        :model-value='config',
        @update:model-value='$emit("update:config", $event)'
      )
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { ZodForm } from 'src/shared/ui/ZodForm';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { isExtensionSchemaEmpty } from 'src/shared/lib/utils';

interface Props {
  schema?: any;
  config: any;
  formRef?: any;
}

const props = defineProps<Props>();

const isEmpty = computed(() => isExtensionSchemaEmpty(props.schema));
</script>

<style lang="scss" scoped>
.extension-settings {
  max-width: 1000px;
  margin: 0 auto;
}
</style>
