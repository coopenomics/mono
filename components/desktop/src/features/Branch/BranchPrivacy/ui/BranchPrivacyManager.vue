<template lang="pug">
.branch-privacy
  BaseCheckbox(
    :model-value='isPrivate',
    :disabled='busy',
    label='Приватный участок — выбрать его при вступлении или смене может только пайщик из белого списка',
    @update:model-value='onTogglePrivate'
  )
  template(v-if='isPrivate')
    .branch-privacy__subtitle.t-sm.t-muted Белый список пайщиков
    .branch-privacy__add
      UserSearchSelector.branch-privacy__search(
        v-model='selected',
        label='Начните ввод ФИО пайщика',
        :exclude='branchAccounts',
        dense
      )
      BaseButton(
        variant='primary',
        :disabled='!selected',
        :loading='busy',
        @click='onAdd'
      ) Добавить
    .branch-privacy__list(v-if='whitelist.length')
      .branch-privacy__member(v-for='member in whitelist', :key='member.username')
        span {{ memberName(member) }}
        button.icon-btn(
          type='button',
          aria-label='Удалить из белого списка',
          :disabled='busy',
          @click='onRemove(member.username)'
        )
          q-icon(name='close')
    .t-sm.t-muted(v-else) Белый список пуст — добавьте пайщиков, которым разрешён выбор этого участка.
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBranchPrivacy } from '../model';
import { useSystemStore } from 'src/entities/System/model';
import { useBranchStore, type IBranch } from 'src/entities/Branch/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseCheckbox } from 'src/shared/ui/base';
import { UserSearchSelector } from 'src/shared/ui';

const props = defineProps<{ branch: IBranch }>();

const { info } = useSystemStore();
const branchStore = useBranchStore();
const { setBranchPrivate, addBranchWhitelist, deleteBranchWhitelist } = useBranchPrivacy();

const busy = ref(false);
const selected = ref('');

const isPrivate = computed(() => props.branch.is_private);
const whitelist = computed(() => props.branch.whitelist_certificates ?? []);

// аккаунты кооперативных участков — не пайщики, их нельзя добавлять в белый список
const branchAccounts = computed(() => branchStore.branches.map((branch) => branch.braname));

function memberName(member: any): string {
  return [member.last_name, member.first_name, member.middle_name].filter(Boolean).join(' ') || member.username;
}

async function onTogglePrivate(value: boolean) {
  busy.value = true;
  try {
    await setBranchPrivate({ coopname: info.coopname, braname: props.branch.braname, is_private: value });
    SuccessAlert(value ? 'Участок сделан приватным' : 'Участок сделан публичным');
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

async function onAdd() {
  if (!selected.value) return;
  busy.value = true;
  try {
    await addBranchWhitelist({ coopname: info.coopname, braname: props.branch.braname, account: selected.value });
    selected.value = '';
    SuccessAlert('Пайщик добавлен в белый список участка');
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

async function onRemove(account: string) {
  busy.value = true;
  try {
    await deleteBranchWhitelist({ coopname: info.coopname, braname: props.branch.braname, account });
    SuccessAlert('Пайщик удалён из белого списка участка');
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.branch-privacy {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.branch-privacy__subtitle {
  margin-top: var(--p-2);
}

.branch-privacy__add {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
}

.branch-privacy__search {
  flex: 1 1 auto;
  max-width: 420px;
}

.branch-privacy__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  max-width: 420px;
}

.branch-privacy__member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  padding: var(--p-2) var(--p-3);
  background: var(--p-surface-1);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
}
</style>
