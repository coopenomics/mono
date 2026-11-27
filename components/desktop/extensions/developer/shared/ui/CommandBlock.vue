<template lang="pug">
//- Команда терминала: текст моноширинным шрифтом, справа кнопка копирования.
.command-block
  pre.command-block__text.t-mono {{ command }}
  BaseButton.command-block__copy(
    variant='ghost',
    size='sm',
    icon-only,
    :aria-label="copied ? $t('developer.command.copied') : $t('developer.command.copy')",
    @click='copy'
  )
    template(#icon-left)
      q-icon(:name="copied ? 'check' : 'content_copy'", size='16px')
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseButton } from 'src/shared/ui/base';

/** Команда для терминала издателя с копированием в буфер. */
const props = defineProps<{ command: string }>();
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.command);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    copied.value = false;
  }
}
</script>

<style scoped>
.command-block {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  padding: var(--p-2) var(--p-2) var(--p-2) var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
}
.command-block__text {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: var(--p-1) 0;
  font-size: var(--p-fs-body-sm);
  white-space: pre-wrap;
  word-break: break-all;
}
.command-block__copy {
  flex: none;
}
</style>
