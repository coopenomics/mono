<template lang="pug">
//- Тонкая обёртка над общим виджетом шасси: capital задаёт пул-источник,
//- ключ черновика и программную подачу на чейн (capital::createpgexp).
ExpenseCreateDialog(
  :model-value='modelValue',
  title='Создание программного расхода',
  :source-wallet='PROGRAM_EXPENSE_SOURCE_WALLET',
  :draft-key='PROGRAM_EXPENSE_DRAFT_KEY',
  :submit='submitProgramExpense',
  @update:model-value='$emit("update:modelValue", $event)',
  @created='$emit("created")'
)
</template>

<script setup lang="ts">
import { ExpenseCreateDialog } from 'src/shared/ui/domain/ExpenseCreateDialog';
import {
  useCreateProgramExpense,
  PROGRAM_EXPENSE_SOURCE_WALLET,
  PROGRAM_EXPENSE_DRAFT_KEY,
} from '../model';

defineProps<{ modelValue: boolean }>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const { submitProgramExpense } = useCreateProgramExpense();
</script>
