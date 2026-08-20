<template lang="pug">
//- Управление верификацией личности из реестра пайщиков: председатель совета
//- подтверждает личность по паспорту и может отозвать подтверждение.
.verify-identity(v-if='canManage')
  BaseButton(
    v-if='!isVerified',
    variant='secondary',
    size='sm',
    :loading='loading',
    @click='confirmOpen = true'
  )
    template(#icon-left)
      q-icon(name='how_to_reg', size='16px')
    | Подтвердить личность
  BaseButton(
    v-else,
    variant='ghost',
    size='sm',
    :loading='loading',
    @click='revokeOpen = true'
  )
    template(#icon-left)
      q-icon(name='person_off', size='16px')
    | Отозвать верификацию

  VerificationConfirmDialog(
    v-model='confirmOpen',
    :full-name='fullName',
    :username='participant.username',
    hint='Сверьте фамилию, имя, отчество и данные паспорта с оригиналом документа. Подтверждение записывается в цепи от вашего имени и делается один раз.',
    :loading='loading',
    @confirm='onVerify'
  )
    .verify-identity__facts(v-if='identityFacts.length')
      DataRow(
        v-for='fact in identityFacts',
        :key='fact.label',
        :label='fact.label',
        :value='fact.value'
      )

  BaseDialog(v-model='revokeOpen', title='Отзыв верификации', size='sm')
    .verify-identity__revoke
      .verify-identity__revoke-name(v-if='fullName') {{ fullName }}
      .verify-identity__revoke-hint
        | Подтверждение личности будет снято, и пайщику снова понадобится
        | предъявить паспорт. Отзывайте, если верификация проведена ошибочно
        | или данные скомпрометированы.
      .verify-identity__revoke-actions
        BaseButton(variant='ghost', :disabled='loading', @click='revokeOpen = false') Отмена
        BaseButton(variant='danger', :loading='loading', @click='onUnverify') Отозвать
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { DataRow, VerificationConfirmDialog } from 'src/shared/ui/domain';
import { useSessionStore } from 'src/entities/Session';
import { getName } from 'src/shared/lib/utils';
import { participantVerificationView } from 'src/shared/lib/verification';
import { AccountTypes, type IAccount } from 'src/entities/Account/types';
import { useVerifyIdentity } from '../model';

const props = defineProps<{
  participant: IAccount;
}>();

const emit = defineEmits<{
  (e: 'changed'): void;
}>();

const session = useSessionStore();
const { verify, unverify, loading } = useVerifyIdentity();
const confirmOpen = ref(false);
const revokeOpen = ref(false);

// Верифицировать и отзывать вправе председатель совета; полномочия повторно
// проверяет контракт, здесь — только видимость кнопок.
const canManage = computed(() => session.isChairman);

const fullName = computed(() => getName(props.participant));

const isVerified = computed(() =>
  participantVerificationView(props.participant).some((level) => level.type === 'passport_onsite'),
);

// Что именно сверять с документом: дата рождения и реквизиты паспорта.
const identityFacts = computed((): Array<{ label: string; value: string }> => {
  const account = props.participant.private_account;
  if (account?.type !== AccountTypes.individual) return [];
  const data = account.individual_data;
  if (!data) return [];
  const facts: Array<{ label: string; value: string }> = [];
  if (data.birthdate) facts.push({ label: 'Дата рождения', value: String(data.birthdate) });
  if (data.passport?.series && data.passport?.number) {
    facts.push({ label: 'Паспорт', value: `${data.passport.series} ${data.passport.number}` });
  }
  return facts;
});

const onVerify = async () => {
  if (await verify(props.participant.username)) {
    confirmOpen.value = false;
    emit('changed');
  }
};

const onUnverify = async () => {
  if (await unverify(props.participant.username)) {
    revokeOpen.value = false;
    emit('changed');
  }
};
</script>

<style scoped lang="scss">
.verify-identity {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
}

.verify-identity__facts {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
}

.verify-identity__revoke {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.verify-identity__revoke-name {
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
  color: var(--p-ink);
}

.verify-identity__revoke-hint {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}

.verify-identity__revoke-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2, 8px);
}
</style>
