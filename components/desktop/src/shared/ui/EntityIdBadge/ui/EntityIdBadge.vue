<template lang="pug">
span.entity-id-badge__pill(
  v-if="displayLabel"
  @click.stop="onActivate"
)
  span.entity-id-badge__prefix(v-if="$slots.prefix")
    slot(name="prefix")
  span.entity-id-badge__label {{ displayLabel }}
  q-icon.entity-id-badge__copy(
    v-if="copyOnClick"
    name="content_copy"
    size="13px"
  )
    q-tooltip Скопировать
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { copyToClipboard } from 'quasar';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';

const props = withDefaults(
  defineProps<{
    /** Сырое значение id (без # — он добавляется внутри) */
    rawId: string | number | null | undefined;
    /** Клик копирует в буфер вместо emit (навигации) */
    copyOnClick?: boolean;
    /** При copyOnClick — копировать `[id][@username]` сессии вместо голого id */
    addressClipboard?: boolean;
    /** Что именно класть в буфер (если отличается от отображаемого id —
        например показываем короткий хеш, а копируем полный) */
    copyValue?: string | null;
  }>(),
  { copyOnClick: false, addressClipboard: false, copyValue: null },
);

const sessionStore = useSessionStore();

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const displayLabel = computed((): string => {
  const v = props.rawId;
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v.trim() : String(v);
  if (s === '') return '';
  return `${s}`;
});

const clipboardText = computed((): string => {
  const base = props.copyValue ? String(props.copyValue).trim() : displayLabel.value;
  if (!base) return '';
  if (!props.addressClipboard) return base;
  const u = String(sessionStore.username ?? '').trim();
  if (u) return `[${base}][@${u}]`;
  return `[${base}]`;
});

const onActivate = async (e: MouseEvent) => {
  if (props.copyOnClick) {
    const text = clipboardText.value;
    if (!text) return;
    try {
      await copyToClipboard(text);
      SuccessAlert('Скопировано');
    } catch {
      FailAlert('Не удалось скопировать');
    }
    return;
  }
  emit('click', e);
};
</script>

<style lang="scss" scoped>
.entity-id-badge__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: var(--p-r-xs, 6px);
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  vertical-align: middle;
  background: var(--p-surface-2);
  color: var(--p-ink-2);
  transition: color var(--p-dur-fast, 120ms) ease, background var(--p-dur-fast, 120ms) ease;
}
.entity-id-badge__pill:hover {
  background: var(--p-line-1);
  color: var(--p-ink-1);
}

.entity-id-badge__prefix {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  line-height: 0;
  color: inherit;

  :deep(.q-icon) {
    color: currentColor;
  }
}

.entity-id-badge__label {
  min-width: 0;
}

.entity-id-badge__copy {
  color: var(--p-ink-3);
  flex-shrink: 0;
}
.entity-id-badge__pill:hover .entity-id-badge__copy {
  color: var(--p-primary);
}
</style>
