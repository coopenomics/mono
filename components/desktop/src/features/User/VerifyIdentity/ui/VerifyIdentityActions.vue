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
    :hint='verifyHint',
    size='md',
    :loading='loading',
    @confirm='onVerify'
  )
    .verify-identity__facts(v-if='identityFacts.length')
      DataRow(
        v-for='fact in identityFacts',
        :key='fact.label',
        :label='fact.label',
        :value='fact.value',
        :align='fact.wide ? "vertical" : "horizontal"'
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
import { formatDocumentDate } from 'src/shared/lib/utils/dates';
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

/** Строка сверки: длинные значения (адрес, кем выдан) идут в две строки. */
interface IdentityFact {
  label: string;
  value: string;
  wide?: boolean;
}

/**
 * Всё, что можно сверить с документом. Паспорт проверяют целиком: ФИО, дата
 * рождения, серия и номер, кем и когда выдан, код подразделения и адрес
 * регистрации — иначе «сверка» сводится к взгляду на две цифры. Для ИП и
 * организаций паспортных данных в кооперативе нет, поэтому показываем то,
 * что есть, — по нему сверяют личность и полномочия.
 */
const identityFacts = computed((): IdentityFact[] => {
  const account = props.participant.private_account;
  const facts: IdentityFact[] = [];

  if (account?.type === AccountTypes.individual) {
    const data = account.individual_data;
    if (!data) return [];
    facts.push({ label: 'Дата рождения', value: formatDocumentDate(data.birthdate) });
    const passport = data.passport;
    if (passport?.series || passport?.number) {
      facts.push({ label: 'Серия и номер', value: `${passport.series ?? ''} ${passport.number ?? ''}`.trim() });
    }
    if (passport?.issued_by) facts.push({ label: 'Кем выдан', value: passport.issued_by, wide: true });
    if (passport?.issued_at) facts.push({ label: 'Дата выдачи', value: formatDocumentDate(passport.issued_at) });
    if (passport?.code) facts.push({ label: 'Код подразделения', value: passport.code });
    if (data.full_address) facts.push({ label: 'Адрес регистрации', value: data.full_address, wide: true });
    return facts.filter((fact) => fact.value);
  }

  if (account?.type === AccountTypes.entrepreneur) {
    const data = account.entrepreneur_data;
    if (!data) return [];
    facts.push({ label: 'Дата рождения', value: formatDocumentDate(data.birthdate) });
    if (data.full_address) facts.push({ label: 'Адрес регистрации', value: data.full_address, wide: true });
    if (data.details?.inn) facts.push({ label: 'ИНН', value: data.details.inn });
    if (data.details?.ogrn) facts.push({ label: 'ОГРНИП', value: data.details.ogrn });
    return facts.filter((fact) => fact.value);
  }

  if (account?.type === AccountTypes.organization) {
    const data = account.organization_data;
    if (!data) return [];
    const rep = data.represented_by;
    if (rep) {
      facts.push({
        label: 'Представитель',
        value: [rep.last_name, rep.first_name, rep.middle_name].filter(Boolean).join(' '),
        wide: true,
      });
      if (rep.position) facts.push({ label: 'Должность', value: rep.position });
      if (rep.based_on) facts.push({ label: 'Действует на основании', value: rep.based_on, wide: true });
    }
    if (data.details?.inn) facts.push({ label: 'ИНН', value: data.details.inn });
    if (data.details?.ogrn) facts.push({ label: 'ОГРН', value: data.details.ogrn });
    if (data.full_address) facts.push({ label: 'Юридический адрес', value: data.full_address, wide: true });
    return facts.filter((fact) => fact.value);
  }

  return facts;
});

// У физлица сверяют паспорт целиком, у ИП и организаций паспорта в данных нет —
// текст подсказки должен обещать ровно то, что показано на экране.
const verifyHint = computed(() =>
  props.participant.private_account?.type === AccountTypes.individual
    ? 'Сверьте с оригиналом паспорта все данные выше: фамилию, имя, отчество, дату рождения, серию и номер, кем и когда выдан, код подразделения и адрес регистрации. Подтверждение записывается в цепи от вашего имени и делается один раз.'
    : 'Сверьте данные выше с документом, удостоверяющим личность, и с документом о полномочиях. Подтверждение записывается в цепи от вашего имени и делается один раз.',
);

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
