<template lang="pug">
BaseForm(:loading='sending', @submit='submit')
  template(v-for='row in notices', :key='row.field.field_key')
    .flow-stage__divider(v-if='row.field.type === "separator"') {{ row.field.placeholder }}
    p.flow-stage__lead(v-else) {{ row.field.initial_value }}
  BaseInput(
    v-for='row in inputs',
    :key='row.field.field_key',
    v-model='row.value',
    :label='row.field.label',
    :type='inputType(row.field)',
    :placeholder='row.field.placeholder',
    :hint='row.field.sub_text',
    :error='fieldError(challenge, row.field.field_key)',
    :autocomplete='autocomplete(row.field)',
    :name='row.field.field_key',
    :required='row.field.required',
    :readonly='readonly(row.field)'
  )
  .flow-stage__actions
    BaseButton(variant='primary', type='submit', :loading='sending') Продолжить
</template>

<script lang="ts" setup>
/**
 * Шаг произвольной формы (стадия `ak-stage-prompt`). Состав полей живёт в блюпринте потока,
 * стол его не дублирует: рисует, что пришло, включая виды полей, которых сегодня в потоках нет.
 */
import { computed, ref, watch } from 'vue';
import { BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { fieldError, type FlowChallenge, type FlowField } from 'src/shared/api/authentik-flow';

type InputType = 'text' | 'email' | 'password' | 'number' | 'date';

const props = defineProps<{ challenge: FlowChallenge; sending: boolean }>();
const emit = defineEmits<{ answer: [payload: Record<string, unknown>] }>();

const SINGLE_LINE: Readonly<Record<string, InputType>> = {
  text: 'text',
  text_read_only: 'text',
  username: 'text',
  email: 'email',
  password: 'password',
  number: 'number',
  date: 'date',
  'date-time': 'text',
};

const fields = computed(() => [...(props.challenge.fields ?? [])].sort((a, b) => a.order - b.order));
const rows = ref(fields.value.map((field) => ({ field, value: field.initial_value ?? '' })));
watch(fields, (next) => {
  rows.value = next.map((field) => ({
    field,
    value: rows.value.find((row) => row.field.field_key === field.field_key)?.value ?? field.initial_value ?? '',
  }));
});

const inputs = computed(() => rows.value.filter((row) => row.field.type in SINGLE_LINE));
const notices = computed(() => rows.value.filter((row) => ['static', 'separator'].includes(row.field.type)));
const inputType = (field: FlowField): InputType => SINGLE_LINE[field.type] ?? 'text';
const readonly = (field: FlowField): boolean => field.type.endsWith('_read_only');
const autocomplete = (field: FlowField): string => {
  if (field.type === 'password') return 'new-password';
  if (field.type === 'email') return 'email';
  if (field.type === 'username') return 'username';
  return 'off';
};

const submit = (): void =>
  emit('answer', {
    component: props.challenge.component,
    ...Object.fromEntries(rows.value.map((row) => [row.field.field_key, row.value])),
  });
</script>
