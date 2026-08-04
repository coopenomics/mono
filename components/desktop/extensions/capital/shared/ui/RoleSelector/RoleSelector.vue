<template lang="pug">
.role-selector
  .roles-grid(:class="{ 'mini-grid': mini }")
    RoleCard(
      v-for="role in roles"
      :key="role.value"
      :value="role.value"
      :title="role.title"
      :description="role.description"
      :icon="getRoleIcon(role.value)"
      :is-selected="modelValue.includes(role.value)"
      :mini="mini"
      @toggle="toggleRole(role.value)"
    )
</template>

<script setup lang="ts">
import { RoleCard } from '../RoleCard';
import type { RoleOption } from './types';

interface Props {
  modelValue: string[];
  roles: RoleOption[];
  mini?: boolean;
}

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const props = defineProps<Props>();

const toggleRole = (roleValue: string) => {
  const currentValue = props.modelValue;
  const newValue = currentValue.includes(roleValue)
    ? currentValue.filter(role => role !== roleValue)
    : [...currentValue, roleValue];
  emit('update:modelValue', newValue);
};

const getRoleIcon = (roleValue: string) => {
  const icons: Record<string, string> = {
    master: 'supervisor_account',
    author: 'edit_note',
    creator: 'engineering',
    investor: 'account_balance_wallet',
    coordinator: 'campaign',
    contributor: 'groups',
    // legacy-алиасы
    noble: 'lightbulb',
    benefactor: 'build',
    philanthropist: 'account_balance_wallet',
    herald: 'campaign',
    early_contributor: 'stars',
  };
  return icons[roleValue] || 'help';
};
</script>

<style lang="scss" scoped>
.role-selector {
  width: 100%;
}

.roles-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  max-width: 800px;
  margin: 0 auto;
  justify-content: center;

  &.mini-grid {
    gap: 12px;
    max-width: 100%;
  }
}
</style>
