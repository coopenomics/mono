<script setup lang="ts">
import { BaseDialog } from 'src/shared/ui/base';
import { CodeScanner } from 'src/widgets/Marketplace/CodeScanner';

/**
 * Общая ВИЗУАЛЬНАЯ обёртка сканера: канон-диалог (`BaseDialog size=sm`) + единый
 * `CodeScanner`. Один внешний вид для всех мест, где сканируют код на столе ПВЗ
 * (приёмка, выдача, универсальный сканер из меню) — чтобы они не расходились.
 *
 * Функционал индивидуален: страница/держатель подписывается на `@scanned` и сам
 * решает, что делать с кодом (приёмка, выдача или маршрутизация по виду кода).
 * Подписи проксируются в `CodeScanner` — текст контекста задаёт вызывающий.
 *
 * `CodeScanner` рендерится только при открытом диалоге (`v-if`), поэтому камера
 * глушится на закрытии (onBeforeUnmount) и каждое открытие — со свежего idle.
 */

defineProps<{
  modelValue: boolean;
  title?: string;
  formats?: string[];
  idleCaption?: string;
  frameHint?: string;
  startLabel?: string;
  manualLabel?: string;
  manualPlaceholder?: string;
  manualButton?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'scanned', code: string): void;
}>();
</script>

<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  :title='title ?? "Сканировать QR"',
  size='sm',
  @update:model-value='emit("update:modelValue", $event)'
)
  CodeScanner(
    v-if='modelValue',
    :formats='formats',
    :idle-caption='idleCaption',
    :frame-hint='frameHint',
    :start-label='startLabel',
    :manual-label='manualLabel',
    :manual-placeholder='manualPlaceholder',
    :manual-button='manualButton',
    @scanned='emit("scanned", $event)'
  )
</template>
