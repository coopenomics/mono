<template lang="pug">
.doc-sig
  //- ============ Контрольная сумма ============
  section.doc-sig__block
    .doc-sig__chip(:class='`doc-sig__chip--${hashState}`')
      q-icon(:name='hashIcon' size='14px')
      span Контрольная сумма
    .doc-sig__hash {{ docHash }}
    .doc-sig__hash-hint(v-if='regeneratedHash !== undefined && !hashMatches')
      q-icon(name='warning_amber' size='14px')
      span Локально пересчитанный хеш не совпадает

  //- ============ Подписи (N) ============
  section.doc-sig__block(v-if='signatures && signatures.length')
    .doc-sig__chip(:class='`doc-sig__chip--${signaturesState}`')
      q-icon(:name='signaturesIcon' size='14px')
      span Подписи ({{ signatures.length }})
    ul.doc-sig__list
      li.doc-sig__item(v-for='(s, idx) in signatures' :key='idx')
        button.doc-sig__row(
          type='button',
          :aria-expanded='isOpen(idx)',
          @click='toggle(idx)'
        )
          .doc-sig__row-icon
            q-icon(
              :name='s.isValid === false ? "error" : "verified"',
              size='16px',
              :class='s.isValid === false ? "doc-sig__row-icon--neg" : "doc-sig__row-icon--pos"'
            )
          .doc-sig__row-name Подпись {{ idx + 1 }}: {{ s.signerName || 'неизвестный подписант' }}
          q-icon.doc-sig__row-caret(
            :name='isOpen(idx) ? "expand_less" : "expand_more"',
            size='18px'
          )
        .doc-sig__details(v-if='isOpen(idx)')
          .doc-sig__field
            span.doc-sig__field-label Подписант
            span.doc-sig__field-value {{ s.signerName || '—' }}
          .doc-sig__field(v-if='s.publicKey')
            span.doc-sig__field-label Публичный ключ
            span.doc-sig__field-value.doc-sig__field-value--mono {{ s.publicKey }}
          .doc-sig__field(v-if='s.signature')
            span.doc-sig__field-label Цифровая подпись
            span.doc-sig__field-value.doc-sig__field-value--mono {{ s.signature }}
          .doc-sig__field
            span.doc-sig__field-label Статус
            span.doc-sig__field-value
              q-icon(
                :name='s.isValid === false ? "cancel" : "check_circle"',
                size='14px',
                :class='s.isValid === false ? "doc-sig__row-icon--neg" : "doc-sig__row-icon--pos"'
              )
              |  {{ s.isValid === false ? 'Не верифицирована' : 'Верифицирована' }}

  //- ============ Действия ============
  .doc-sig__actions(v-if='!hideDownload || !hideVerify')
    BaseButton(
      v-if='!hideDownload',
      variant='ghost',
      size='sm',
      @click='$emit("download")'
    )
      q-icon(name='download' size='16px')
      span.q-ml-sm скачать
    BaseButton(
      v-if='!hideVerify',
      variant='primary',
      size='sm',
      :loading='verifying',
      @click='$emit("verify")'
    )
      q-icon(name='fact_check' size='16px')
      span.q-ml-sm сверить
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import type { DocumentSignaturesProps } from './DocumentSignatures.types';

const props = withDefaults(defineProps<DocumentSignaturesProps>(), {
  signatures: () => [],
  verifying: false,
  hideDownload: false,
  hideVerify: false,
});

defineEmits<{
  download: [];
  verify: [];
}>();

const hashMatches = computed((): boolean =>
  props.regeneratedHash === undefined ? true : props.regeneratedHash === props.docHash,
);

const hashState = computed((): 'pos' | 'neutral' | 'neg' => {
  if (props.regeneratedHash === undefined) return 'neutral';
  return hashMatches.value ? 'pos' : 'neg';
});

const hashIcon = computed(() => (hashState.value === 'neg' ? 'cancel' : 'verified'));

const hasInvalid = computed((): boolean => props.signatures.some((s) => s.isValid === false));

const signaturesState = computed((): 'pos' | 'neg' => (hasInvalid.value ? 'neg' : 'pos'));
const signaturesIcon = computed(() => (hasInvalid.value ? 'error' : 'verified'));

const openIdx = ref<Set<number>>(new Set());
function isOpen(idx: number): boolean { return openIdx.value.has(idx); }
function toggle(idx: number): void {
  const next = new Set(openIdx.value);
  if (next.has(idx)) next.delete(idx);
  else next.add(idx);
  openIdx.value = next;
}
</script>

<style scoped>
.doc-sig {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
}

.doc-sig__block {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

/* ============ Chip-заголовок «Контрольная сумма» / «Подписи (N)» ============ */
.doc-sig__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  padding: 2px var(--p-2, 8px);
  border-radius: var(--p-r-pill, 999px);
  font-size: var(--p-fs-meta, 12px);
  line-height: var(--p-lh-meta, 1.4);
  align-self: flex-start;
}
.doc-sig__chip--pos { background: var(--p-pos-soft); color: var(--p-pos); }
.doc-sig__chip--neg { background: var(--p-neg-soft); color: var(--p-neg); }
.doc-sig__chip--neutral { background: var(--p-surface-3); color: var(--p-ink-2); }

/* ============ Hex-хеш ============ */
.doc-sig__hash {
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  color: var(--p-ink-1);
  word-break: break-all;
  padding: var(--p-2, 8px) var(--p-3, 12px);
  background: var(--p-surface-2);
  border-radius: var(--p-r-sm, 8px);
}
.doc-sig__hash-hint {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  color: var(--p-neg);
  font-size: var(--p-fs-meta, 12px);
}

/* ============ Список подписей ============ */
.doc-sig__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm, 8px);
  overflow: hidden;
}
.doc-sig__item + .doc-sig__item {
  border-top: 1px solid var(--p-line);
}

.doc-sig__row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--p-2, 8px);
  width: 100%;
  padding: var(--p-2, 8px) var(--p-3, 12px);
  background: transparent;
  border: none;
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  text-align: left;
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.doc-sig__row:hover { background: var(--p-surface-2); }
.doc-sig__row:focus-visible { outline: none; box-shadow: inset var(--p-focus-ring); }

.doc-sig__row-icon { display: inline-flex; flex-shrink: 0; }
.doc-sig__row-icon--pos { color: var(--p-pos); }
.doc-sig__row-icon--neg { color: var(--p-neg); }

.doc-sig__row-name {
  overflow-wrap: anywhere;
  min-width: 0;
}

.doc-sig__row-caret {
  flex-shrink: 0;
  color: var(--p-ink-3);
}

.doc-sig__details {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px) var(--p-4, 16px);
  background: var(--p-surface-2);
  border-top: 1px solid var(--p-line);
}

.doc-sig__field {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
}
.doc-sig__field-label {
  color: var(--p-ink-2);
  font-size: var(--p-fs-meta, 12px);
  line-height: var(--p-lh-meta, 1.4);
}
.doc-sig__field-value {
  color: var(--p-ink-1);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
  overflow-wrap: anywhere;
}
.doc-sig__field-value--mono {
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  word-break: break-all;
}

/* ============ Действия ============ */
.doc-sig__actions {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
}
</style>
