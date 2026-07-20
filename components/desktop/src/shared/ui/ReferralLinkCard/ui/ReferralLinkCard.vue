<template lang="pug">
ColorCard(:transparent="true")
  .card-label {{ label }}
  .row.items-center.no-wrap
    .card-value.cursor-pointer.full-width(@click="copyToClipboard")
      q-icon.q-mr-xs(
        name="content_copy"
        size="16px"
        color="grey-6"
      )
      span.text-no-wrap {{ link }}
</template>

<style lang="scss" scoped>
.card-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-label {
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}
</style>

<script setup lang="ts">
import { copyToClipboard as copy } from 'quasar';
import { ColorCard } from 'src/shared/ui';
import { SuccessAlert } from 'src/shared/api';

interface Props {
  link: string;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Ссылка для приглашений',
});

const copyToClipboard = async () => {
  try {
    await copy(props.link);
    SuccessAlert('Ссылка скопирована в буфер обмена');
  } catch (error) {
    console.error('Ошибка при копировании:', error);
  }
};
</script>
