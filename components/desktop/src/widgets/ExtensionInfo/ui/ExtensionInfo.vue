<template lang="pug">
.extension-info
  .extension-info__head
    h2.extension-info__title {{ extension.title }}
    span.badge.badge--pos(v-if='extension.is_installed && extension.enabled')
      q-icon(name='fa-solid fa-check' size='11px')
      | Установлено
    span.badge.badge--warn(v-else-if='extension.is_installed && !extension.enabled')
      q-icon(name='fa-solid fa-pause' size='11px')
      | Отключено
    span.badge.badge--warn(v-else-if='!extension.is_available')
      q-icon(name='fa-solid fa-screwdriver-wrench' size='11px')
      | В разработке

  ClientOnly
    template(#default)
      vue-markdown.description(:source='extension.readme')
</template>

<script lang="ts" setup>
import { defineAsyncComponent } from 'vue';
import type { IExtension } from 'src/entities/Extension/model/types';
import { ClientOnly } from 'src/shared/ui/ClientOnly';

// Клиентский компонент для markdown, загружаемый только на клиенте
const VueMarkdown = defineAsyncComponent(() =>
  import('vue-markdown-render').then((mod) => mod.default),
);

interface Props {
  extension: IExtension;
}

defineProps<Props>();
</script>

<style scoped lang="scss">
.extension-info__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  margin-bottom: var(--p-5, 20px);
}

.extension-info__title {
  margin: 0;
  font-size: var(--p-fs-h1, 24px);
  font-weight: 700;
  letter-spacing: var(--p-ls-h1, -0.01em);
  color: var(--p-ink);
}

.description {
  color: var(--p-ink-1);
  font-size: var(--p-fs-body);
  line-height: 1.6;
}
</style>
