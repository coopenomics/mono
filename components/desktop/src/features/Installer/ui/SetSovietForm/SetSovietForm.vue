<template lang="pug">
.set-soviet(v-if='installStore')
  p.set-soviet__requirement(v-if='minSovietMembers > 1')
    | В составе совета — минимум {{ minSovietMembers }}&nbsp;человека: председатель и члены совета.

  .soviet-member(v-for='(member, index) in installStore.soviet', :key='member.id')
    .soviet-member__head
      span.soviet-member__role
        | {{ index + 1 }}.&nbsp;
        | {{ member.role === 'chairman' ? 'Председатель совета' : 'Член совета' }}
      q-btn(
        v-if='member.role === "member"',
        flat,
        dense,
        round,
        size='sm',
        icon='close',
        aria-label='Удалить члена совета',
        @click='del(member.id)'
      )

    IndividualDataForm(v-model:userData='installStore.soviet[index]')
      template(#top)
        q-input(
          autofocus,
          outlined,
          dense,
          color='primary',
          v-model='installStore.soviet[index].individual_data.email',
          label='Электронная почта',
          type='email',
          :rules='[val => notEmpty(val), val => validEmail(val)]'
        )

  p.set-soviet__progress(v-if='progressHint') {{ progressHint }}

  .set-soviet__actions
    BaseButton(variant='ghost', @click='back')
      q-icon(name='arrow_back', size='16px')
      span.q-ml-sm Назад
    .set-soviet__actions-right
      BaseButton(variant='secondary', @click='add')
        q-icon(name='add', size='16px')
        span.q-ml-sm Добавить члена совета
      span.set-soviet__continue-wrap
        q-tooltip(v-if='!canContinue') {{ continueBlockedTooltip }}
        BaseButton(
          variant='primary',
          :loading='loading',
          :disabled='!canContinue',
          @click='next'
        )
          span.q-mr-sm Продолжить
          q-icon(name='arrow_forward', size='16px')
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useInstallCooperativeStore } from 'src/entities/Installer/model';
import { IndividualDataForm } from 'src/shared/ui/UserDataForm/IndividualDataForm';
import type { IIndividualData } from 'src/shared/lib/types/user/IUserData';
import { FailAlert } from 'src/shared/api';
import {
  getMinSovietMembersCount,
  getSovietMembersProgressHint,
  getSovietContinueBlockedTooltip,
} from '../../lib';
import { notEmpty } from 'src/shared/lib/utils';
import { validEmail } from 'src/shared/lib/utils/validEmailRule';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const installStore = useInstallCooperativeStore();
const minSovietMembers = getMinSovietMembersCount();

installStore.is_finish = false;

const sovietCount = computed(() => installStore.soviet.length);
const canContinue = computed(() => sovietCount.value >= minSovietMembers);
const progressHint = computed(() => getSovietMembersProgressHint(sovietCount.value, minSovietMembers));
const continueBlockedTooltip = computed(() =>
  getSovietContinueBlockedTooltip(sovietCount.value, minSovietMembers),
);

const add = () => {
  let role: 'chairman' | 'member' = 'chairman';

  if (installStore.soviet.length > 0)
    role = 'member';

  installStore.soviet.push({ id: Date.now(), type: 'individual', role, individual_data: {} as IIndividualData });
};

const del = (id: number) => {
  installStore.soviet = installStore.soviet.filter(el => el.id !== id);
};
const loading = ref(false);

const back = () => {
  installStore.current_step = 'init';
};

const next = async () => {
  if (!canContinue.value) return;

  try {
    loading.value = true;
    installStore.current_step = 'vars';
  } catch (e: any) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};

if (installStore.soviet.length == 0) {
  for (let i = 0; i < minSovietMembers; i++) {
    add();
  }
}
</script>

<style scoped lang="scss">
.set-soviet {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

.set-soviet__requirement,
.set-soviet__progress {
  margin: 0;
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink-2);
}

.set-soviet__progress {
  color: var(--p-warn, var(--p-ink-2));
}

.soviet-member {
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.soviet-member__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
}
.soviet-member__role {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  color: var(--p-ink-1);
}

.set-soviet__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
}
.set-soviet__actions-right {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
}
.set-soviet__continue-wrap {
  display: inline-flex;
}
</style>
