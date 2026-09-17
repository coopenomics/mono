<template lang="pug">
//- Ответы заявителя на анкеты вступления — обратная сторона формы: та же схема,
//- только чтение. Подписи полей берутся из снимка схемы на момент подачи, поэтому
//- читаются и после того, как расширение выключили или поменяли анкету.
.intake-answers
  section.intake-answers__form(v-for='answer in answers', :key='answer.form_id')
    .intake-answers__title(v-if='showTitle(answer)') {{ answer.title }}
    DataRow(
      v-for='row in rowsOf(answer)',
      :key='row.key',
      :label='row.label',
      :align='row.multiline ? "vertical" : "horizontal"'
    )
      template(#value-override)
        a.intake-answers__value(
          v-if='row.link',
          :href='row.value',
          target='_blank',
          rel='noopener noreferrer nofollow'
        ) {{ row.value }}
        span.intake-answers__value(v-else, :class='{ "intake-answers__value--multiline": row.multiline }') {{ row.value }}
    .intake-answers__date.t-sm.t-muted Подано {{ formatDate(answer.submitted_at) }}
</template>

<script setup lang="ts">
import { date } from 'quasar';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { isWebLink, type IIntakeSchema, type IIntakeSchemaProperty } from 'src/shared/lib/intake-schema';
import type { ICandidateIntakeAnswer } from '../model';

const props = defineProps<{
  answers: ICandidateIntakeAnswer[];
}>();

interface IAnswerRow {
  key: string;
  label: string;
  value: string;
  multiline: boolean;
  /** Ссылку из анкеты показываем ссылкой, но только на сайт (http/https). */
  link: boolean;
}

const display = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
};

const isEmpty = (value: unknown): boolean => value === null || value === undefined || value === '';

const isMultiline = (property: IIntakeSchemaProperty, value: unknown): boolean =>
  Boolean(property.description?.maxRows || property.description?.minRows) || String(value).includes('\n');

/** Ссылку из анкеты показываем ссылкой, но только на сайт (http/https). */
const isLink = (property: IIntakeSchemaProperty, value: unknown): boolean =>
  property.format === 'uri' && typeof value === 'string' && isWebLink(value);

const scalarRow = (key: string, label: string, property: IIntakeSchemaProperty, value: unknown): IAnswerRow => ({
  key,
  label,
  value: display(value),
  multiline: isMultiline(property, value),
  link: isLink(property, value),
});

/** Поля анкеты в порядке схемы; вложенный объект разворачивается с составной подписью. */
const collectRows = (
  properties: Record<string, IIntakeSchemaProperty>,
  values: Record<string, unknown>,
  prefix = '',
): IAnswerRow[] =>
  Object.entries(properties).flatMap(([name, property]) => {
    const value = values?.[name];
    if (isEmpty(value)) return [];
    const label = `${prefix}${property.description?.label ?? name}`;
    const nested = property.type === 'object' && property.properties && typeof value === 'object';
    return nested
      ? collectRows(property.properties!, value as Record<string, unknown>, `${label} — `)
      : [scalarRow(`${prefix}${name}`, label, property, value)];
  });

const rowsOf = (answer: ICandidateIntakeAnswer): IAnswerRow[] => {
  const schema = (answer.json_schema ?? {}) as IIntakeSchema;
  const values = (answer.values ?? {}) as Record<string, unknown>;
  const rows = collectRows(schema.properties ?? {}, values);

  // Значения, которых в снимке схемы нет, всё равно показываем — под именем поля.
  const known = new Set(Object.keys(schema.properties ?? {}));
  for (const [name, value] of Object.entries(values)) {
    if (known.has(name) || isEmpty(value)) continue;
    rows.push({ key: name, label: name, value: display(value), multiline: false, link: false });
  }
  return rows;
};

// Заголовок анкеты лишний, когда она одна и её единственное поле названо так же.
const showTitle = (answer: ICandidateIntakeAnswer): boolean => {
  const rows = rowsOf(answer);
  return props.answers.length > 1 || rows.length !== 1 || rows[0].label !== answer.title;
};

const formatDate = (value: unknown): string => date.formatDate(String(value), 'DD.MM.YYYY HH:mm');
</script>

<style scoped>
.intake-answers__form + .intake-answers__form {
  margin-top: var(--p-5, 20px);
}
.intake-answers__title {
  margin-bottom: var(--p-2, 8px);
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  color: var(--p-ink);
}
.intake-answers__value {
  min-width: 0;
  overflow-wrap: anywhere;
}
.intake-answers__value--multiline {
  white-space: pre-wrap;
}
.intake-answers__date {
  margin-top: var(--p-2, 8px);
}
</style>
