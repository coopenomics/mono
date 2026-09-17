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
        span.intake-answers__value(:class='{ "intake-answers__value--multiline": row.multiline }') {{ row.value }}
    .intake-answers__date.t-sm.t-muted Подано {{ formatDate(answer.submitted_at) }}
</template>

<script setup lang="ts">
import { date } from 'quasar';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import type { IIntakeSchema, IIntakeSchemaProperty } from 'src/shared/lib/intake-schema';
import type { ICandidateIntakeAnswer } from '../model';

const props = defineProps<{
  answers: ICandidateIntakeAnswer[];
}>();

interface IAnswerRow {
  key: string;
  label: string;
  value: string;
  multiline: boolean;
}

const display = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
};

/** Поля анкеты в порядке схемы; вложенный объект разворачивается с составной подписью. */
const collectRows = (
  properties: Record<string, IIntakeSchemaProperty>,
  values: Record<string, unknown>,
  prefix = '',
): IAnswerRow[] => {
  const rows: IAnswerRow[] = [];
  for (const [name, property] of Object.entries(properties)) {
    const value = values?.[name];
    if (value === null || value === undefined || value === '') continue;
    const label = `${prefix}${property.description?.label ?? name}`;

    if (property.type === 'object' && property.properties && typeof value === 'object') {
      rows.push(...collectRows(property.properties, value as Record<string, unknown>, `${label} — `));
      continue;
    }

    rows.push({
      key: `${prefix}${name}`,
      label,
      value: display(value),
      multiline: Boolean(property.description?.maxRows) || String(value).includes('\n'),
    });
  }
  return rows;
};

const rowsOf = (answer: ICandidateIntakeAnswer): IAnswerRow[] => {
  const schema = (answer.json_schema ?? {}) as IIntakeSchema;
  const values = (answer.values ?? {}) as Record<string, unknown>;
  const rows = collectRows(schema.properties ?? {}, values);

  // Значения, которых в снимке схемы нет, всё равно показываем — под именем поля.
  const known = new Set(Object.keys(schema.properties ?? {}));
  for (const [name, value] of Object.entries(values)) {
    if (known.has(name) || value === null || value === undefined || value === '') continue;
    rows.push({ key: name, label: name, value: display(value), multiline: false });
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
