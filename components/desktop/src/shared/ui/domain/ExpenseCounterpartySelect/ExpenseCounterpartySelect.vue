<template lang="pug">
//- Получатель-организация из реестра контрагентов (задача 99D-35). Список —
//- все действующие контрагенты кооператива: участок видит и контрагентов
//- кооператива, и чужих участков. Нужного нет — «Добавить» прямо в поле
//- открывает ту же форму, что на столе совета, и новый контрагент сразу выбран.
.cp-select
  BaseSelect(
    :model-value='modelValue ?? null',
    :options='options',
    :label='label ?? $t("ui.expenseCounterparty.selectLabel")',
    :placeholder='$t("ui.expenseCounterparty.selectPlaceholder")',
    :hint='!selected && loaded && !items.length ? $t("ui.expenseCounterparty.selectEmpty") : undefined',
    :error='error',
    :disabled='disabled',
    searchable,
    required,
    @update:model-value='onPick'
  )
    template(#append)
      BaseButton(
        variant='secondary',
        size='sm',
        :disabled='disabled',
        @click.stop='addOpen = true'
      )
        template(#icon-left)
          q-icon(name='add', size='16px')
        | {{ $t('ui.expenseCounterparty.addAction') }}

  //- Реквизиты выбранного контрагента — блоком под полем, а не подсказкой:
  //- строка подсказки поля одна и с абсолютной позицией, длинные реквизиты
  //- налезали на поле суммы ниже (кадры ui-docs 13.11.2026, 598-63).
  .cp-select__requisites(v-if='selected') {{ selected.requisites_text }}

  ExpenseCounterpartyFormDialog(
    v-model='addOpen',
    :braname='braname ?? null',
    @saved='onCreated'
  )
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { BaseButton, BaseSelect } from 'src/shared/ui/base';
import type { BaseSelectOption } from 'src/shared/ui/base';
import { ExpenseCounterpartyFormDialog } from 'src/shared/ui/domain/ExpenseCounterpartyFormDialog';
import { listExpenseCounterparties, type ExpenseCounterpartyView } from 'src/shared/lib/expenses/counterparties';

const props = defineProps<{
  modelValue?: number | null;
  /** Участок, от имени которого добавляется новый контрагент; пусто — контрагент кооператива. */
  braname?: string | null;
  label?: string;
  error?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number | null];
  /** Выбранный контрагент целиком — наименование, реквизиты, назначение по умолчанию. */
  selected: [counterparty: ExpenseCounterpartyView | null];
}>();

const items = ref<ExpenseCounterpartyView[]>([]);
const loaded = ref(false);
const addOpen = ref(false);

const options = computed<BaseSelectOption[]>(() =>
  items.value.map((c) => ({ value: c.id, label: c.name, caption: c.tax_id })),
);

const selected = computed(() => items.value.find((c) => c.id === props.modelValue) ?? null);

async function load(): Promise<void> {
  try {
    items.value = await listExpenseCounterparties({});
  } catch (e) {
    FailAlert(e);
  } finally {
    loaded.value = true;
  }
  if (props.modelValue) emit('selected', selected.value);
}

function onPick(value: string | number | null): void {
  const id = value === null ? null : Number(value);
  emit('update:modelValue', id);
  emit('selected', items.value.find((c) => c.id === id) ?? null);
}

function onCreated(cp: ExpenseCounterpartyView): void {
  items.value = [...items.value.filter((c) => c.id !== cp.id), cp].sort((a, b) => a.name.localeCompare(b.name));
  onPick(cp.id);
}

onMounted(load);
</script>

<style lang="scss" scoped>
.cp-select {
  min-width: 0;

  &__requisites {
    margin-top: var(--p-1);
    padding: 0 var(--p-3);
    font-size: var(--p-fs-body-sm);
    line-height: 1.4;
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }
}
</style>
