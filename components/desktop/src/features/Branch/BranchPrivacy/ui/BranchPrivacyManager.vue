<template lang="pug">
.branch-privacy
  BaseCheckbox(
    :model-value='isPrivate',
    :disabled='busy',
    :label='$t("branch.branchPrivacyManager.privateToggleLabel")',
    @update:model-value='onTogglePrivate'
  )
  template(v-if='isPrivate')
    .branch-privacy__subtitle.t-sm.t-muted {{ $t('branch.branchPrivacyManager.whitelistTitle') }}
    .branch-privacy__add
      UserSearchSelector.branch-privacy__search(
        v-model='selected',
        :label='$t("branch.branchPrivacyManager.searchLabel")',
        :exclude='branchAccounts',
        dense
      )
      BaseButton(
        variant='primary',
        :disabled='!selected',
        :loading='busy',
        @click='onAdd'
      ) {{ $t('common.action.add') }}
    .branch-privacy__list(v-if='whitelist.length')
      .branch-privacy__member(v-for='member in whitelist', :key='member.username')
        span {{ memberName(member) }}
        button.icon-btn(
          type='button',
          :aria-label='$t("branch.branchPrivacyManager.removeAriaLabel")',
          :disabled='busy',
          @click='onRemove(member.username)'
        )
          q-icon(name='close')
    .t-sm.t-muted(v-else) {{ $t('branch.branchPrivacyManager.whitelistEmpty') }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBranchPrivacy } from '../model';
import { useSystemStore } from 'src/entities/System/model';
import { useBranchStore, type IBranch } from 'src/entities/Branch/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseCheckbox } from 'src/shared/ui/base';
import { UserSearchSelector } from 'src/shared/ui';
import { t } from 'src/shared/i18n';

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
    SuccessAlert(value ? t('branch.branchPrivacyManager.madePrivateSuccess') : t('branch.branchPrivacyManager.madePublicSuccess'));
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
    SuccessAlert(t('branch.branchPrivacyManager.memberAddedSuccess'));
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
    SuccessAlert(t('branch.branchPrivacyManager.memberRemovedSuccess'));
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
