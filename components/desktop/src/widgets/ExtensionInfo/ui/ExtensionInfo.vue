<template lang="pug">
.extension-info
  .extension-info__head
    h2.extension-info__title {{ extension.title }}
    span.badge.badge--pos(v-if='extension.is_installed && extension.enabled')
      q-icon(name='check' size='14px')
      | {{ $t('extensionInfo.extensionInfo.installedBadge') }}
    span.badge.badge--warn(v-else-if='extension.is_installed && !extension.enabled')
      q-icon(name='pause' size='14px')
      | {{ $t('extensionInfo.extensionInfo.disabledBadge') }}
    span.badge.badge--warn(v-else-if='!extension.is_available')
      q-icon(name='construction' size='14px')
      | {{ $t('extensionInfo.extensionInfo.inDevelopmentBadge') }}

  ClientOnly
    template(#default)
      vue-markdown.extension-info__body(:source='readmeBody')
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent } from 'vue';
import type { IExtension } from 'src/entities/Extension/model/types';
import { ClientOnly } from 'src/shared/ui/ClientOnly';

// Клиентский компонент для markdown, загружаемый только на клиенте
const VueMarkdown = defineAsyncComponent(() =>
  import('vue-markdown-render').then((mod) => mod.default),
);

interface Props {
  extension: IExtension;
}

const props = defineProps<Props>();

// Описание приложения начинается с заголовка «# Название». Название уже стоит
// в шапке страницы, поэтому первый заголовок описания здесь не показывается.
const readmeBody = computed(() => String(props.extension.readme ?? '').replace(/^\s*#\s+[^\n]*\n+/, ''));
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
  // Quasar задаёт h2 высоту строки 3.75rem — над названием был лишний отступ
  line-height: var(--p-lh-h1);
  font-size: var(--p-fs-h1, 24px);
  font-weight: 700;
  letter-spacing: var(--p-ls-h1, -0.01em);
  color: var(--p-ink);
}

// Описание приложения — текст для чтения председателем и советом: чуть
// крупнее основного шрифта стола, с воздухом между абзацами и пунктами и
// шириной строки, удобной глазу (замечание владельца 24.11.2026: «всё сжато»)
.extension-info__body {
  max-width: 72ch;
  color: var(--p-ink-1);
  font-size: var(--p-fs-h3);
  line-height: 1.7;

  :deep(p) {
    margin: 0 0 var(--p-4);
  }
  :deep(ul),
  :deep(ol) {
    margin: 0 0 var(--p-4);
    padding-left: var(--p-5);
  }
  :deep(li) {
    margin-bottom: var(--p-3);
    padding-left: var(--p-1);
  }
  :deep(li::marker) {
    color: var(--p-primary);
  }
  :deep(h2),
  :deep(h3) {
    margin: var(--p-5) 0 var(--p-3);
    font-size: var(--p-fs-h2);
    line-height: var(--p-lh-h2);
    font-weight: 600;
    color: var(--p-ink);
  }
  :deep(strong) {
    font-weight: 600;
    color: var(--p-ink);
  }
  :deep(> :last-child) {
    margin-bottom: 0;
  }
}
</style>
