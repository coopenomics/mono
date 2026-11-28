<template lang="pug">
//- Блок кода канона: тёмная плашка, копирование — значком в правом верхнем
//- углу, пояснение — строкой под блоком.
.code-block
  .code-block__label(v-if='label') {{ label }}
  .code-block__box
    pre.code-block__code {{ value }}
    button.code-block__copy(
      v-if='copyable',
      type='button',
      :aria-label="$t('ui.codeBlock.copyAriaLabel')",
      @click='copy'
    )
      q-icon(:name="copied ? 'check' : 'content_copy'", size='16px')
  .code-block__note(v-if='note') {{ note }}
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { copyToClipboard, Notify } from 'quasar';
import { t } from 'src/shared/i18n';
import type { CodeBlockProps } from './CodeBlock.types';

const props = withDefaults(defineProps<CodeBlockProps>(), { label: '', note: '', copyable: true });

/** Отметка «скопировано» на значке. */
const copied = ref(false);

async function copy(): Promise<void> {
  try {
    await copyToClipboard(props.value);
    copied.value = true;
    // timing: ui — значок «скопировано» держится полторы секунды и возвращается к копированию
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    Notify.create({ type: 'negative', message: t('ui.codeBlock.copyErrorText'), timeout: 2000, position: 'top' });
  }
}
</script>

<style scoped>
.code-block + .code-block {
  margin-top: var(--p-4);
}
.code-block__label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
  margin-bottom: var(--p-1);
}
.code-block__box {
  position: relative;
  border-radius: var(--p-r-md);
  background: var(--p-ink);
  color: var(--p-canvas);
}
/* Тёмная тема: блок темнее карточки, текст светлый. */
:global([data-theme='dark']) .code-block__box {
  background: var(--p-canvas);
  color: var(--p-ink);
  border: 1px solid var(--p-line);
}
.code-block__code {
  margin: 0;
  padding: var(--p-3) var(--p-10) var(--p-3) var(--p-4);
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.code-block__copy {
  position: absolute;
  top: var(--p-2);
  right: var(--p-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--p-7);
  height: var(--p-7);
  border: 0;
  border-radius: var(--p-r-sm);
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
}
.code-block__copy:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.code-block__note {
  margin-top: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
</style>
