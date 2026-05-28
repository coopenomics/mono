<template lang="pug">
.profile-page(v-if='currentProfile')
  //- Шапка-удостоверение: ФИО/наименование пайщика + роль в кооперативе.
  IdentityPanel(:identity='identity')

  //- Учётная запись: имя аккаунта и публичный ключ — копируемые,
  //- моноширинные (это технические идентификаторы блокчейн-аккаунта).
  BaseCard(title='Учётная запись')
    DataRow(label='Имя аккаунта', :value='session.username', copyable, mono)
    DataRow(label='Публичный ключ', :value='publicKey', copyable, mono)

  BaseCard(title='Личные данные')
    DataRow(label='Email', :value='currentProfile.email')
    DataRow(label='Телефон', :value='currentProfile.phone')
    DataRow(
      v-if='hasBirthdate',
      label='Дата рождения',
      :value='formatDate(getBirthdate())'
    )
    DataRow(
      v-if='currentProfile.full_address',
      label='Адрес',
      :value='currentProfile.full_address'
    )
    template(v-if='organizationProfile')
      DataRow(
        v-if='organizationProfile.type',
        label='Тип организации',
        :value='getOrganizationType(organizationProfile.type)'
      )
      DataRow(
        v-if='organizationProfile.short_name',
        label='Краткое наименование',
        :value='organizationProfile.short_name'
      )

  BaseCard(v-if='hasRequisites', title='Документы и реквизиты')
    //- Паспортные данные — физическое лицо
    template(v-if='individualProfile?.passport')
      DataRow(label='Серия и номер паспорта', :value='passportSeriesNumber')
      DataRow(
        label='Дата выдачи',
        :value='formatDate(individualProfile.passport.issued_at)'
      )
      DataRow(label='Код подразделения', :value='individualProfile.passport.code')
      DataRow(
        v-if='individualProfile.passport.issued_by',
        label='Кем выдан',
        :value='individualProfile.passport.issued_by'
      )
    //- Реквизиты индивидуального предпринимателя
    template(v-if='entrepreneurProfile?.details')
      DataRow(
        v-if='entrepreneurProfile.details.inn',
        label='ИНН',
        :value='entrepreneurProfile.details.inn',
        copyable,
        mono
      )
      DataRow(
        v-if='entrepreneurProfile.details.ogrn',
        label='ОГРН',
        :value='entrepreneurProfile.details.ogrn',
        copyable,
        mono
      )
      DataRow(
        v-if='entrepreneurProfile.city',
        label='Город',
        :value='entrepreneurProfile.city'
      )
    //- Реквизиты организации
    template(v-if='organizationProfile')
      DataRow(
        v-if='organizationProfile.details?.inn',
        label='ИНН',
        :value='organizationProfile.details.inn',
        copyable,
        mono
      )
      DataRow(
        v-if='organizationProfile.details?.ogrn',
        label='ОГРН',
        :value='organizationProfile.details.ogrn',
        copyable,
        mono
      )
      DataRow(
        v-if='organizationProfile.fact_address',
        label='Фактический адрес',
        :value='organizationProfile.fact_address'
      )
      DataRow(
        v-if='organizationProfile.represented_by',
        label='Представитель',
        :value='getRepresentativeName(organizationProfile.represented_by)'
      )
      DataRow(
        v-if='organizationProfile.represented_by?.position',
        label='Должность',
        :value='organizationProfile.represented_by.position'
      )

.profile-page(v-else)
  EmptyState(
    title='Профиль не заполнен',
    body='Обратитесь к администратору для заполнения профиля'
  )
    template(#icon)
      q-icon(name='badge', size='48px')
</template>

<script lang="ts" setup>
import { useSessionStore } from 'src/entities/Session';
import type {
  IEntrepreneurData,
  IIndividualData,
  IOrganizationData,
} from 'src/shared/lib/types/user/IUserData';
import { computed } from 'vue';
import { useDisplayName } from 'src/shared/lib/composables/useDisplayName';
import { IdentityPanel } from 'src/shared/ui/domain/IdentityPanel';
import type { Identity } from 'src/shared/ui/domain/IdentityPanel';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { EmptyState } from 'src/shared/ui/base/EmptyState';

const session = useSessionStore();

const userType = computed(() => {
  return session.privateAccount?.type;
});

const userProfile = computed(() => {
  return (
    session.privateAccount?.individual_data ||
    session.privateAccount?.organization_data ||
    session.privateAccount?.entrepreneur_data ||
    null
  );
});

const individualProfile = computed(() => {
  if (userType.value === 'individual') {
    return userProfile.value as IIndividualData;
  }
  return null;
});

const entrepreneurProfile = computed(() => {
  if (userType.value === 'entrepreneur') {
    return userProfile.value as IEntrepreneurData;
  }
  return null;
});

const organizationProfile = computed(() => {
  if (userType.value === 'organization') {
    return userProfile.value as IOrganizationData;
  }
  return null;
});

// Текущий профиль для отображения
const currentProfile = computed(() => {
  return (
    individualProfile.value ||
    entrepreneurProfile.value ||
    organizationProfile.value
  );
});

const { displayName, isIP } = useDisplayName(currentProfile.value);

const role = computed(() => {
  if (session.isChairman) return 'Председатель совета';
  else if (session.isMember) return 'Член совета';
  else return 'Пайщик';
});

// Шапка-удостоверение: имя/наименование пайщика (с пометкой ИП) + роль.
const identity = computed<Identity>(() => ({
  fullName: (isIP.value ? 'ИП ' : '') + (displayName.value || ''),
  role: role.value,
}));

// Публичный ключ из блокчейн-аккаунта
const publicKey = computed(() => {
  return (
    session.blockchainAccount?.permissions?.[0]?.required_auth?.keys?.[0]?.key ||
    ''
  );
});

// Проверяем наличие birthdate для типов, у которых оно есть
const hasBirthdate = computed(() => {
  return (
    (userType.value === 'individual' && individualProfile.value?.birthdate) ||
    (userType.value === 'entrepreneur' && entrepreneurProfile.value?.birthdate)
  );
});

// Серия и номер паспорта одной строкой
const passportSeriesNumber = computed(() => {
  const p = individualProfile.value?.passport;
  if (!p) return '';
  return `${p.series} ${p.number}`;
});

// Есть ли что показывать в блоке «Документы и реквизиты»
const hasRequisites = computed(() => {
  return Boolean(
    individualProfile.value?.passport ||
      entrepreneurProfile.value?.details ||
      (organizationProfile.value &&
        (organizationProfile.value.details ||
          organizationProfile.value.fact_address ||
          organizationProfile.value.represented_by)),
  );
});

// Получаем birthdate в зависимости от типа пользователя
const getBirthdate = () => {
  if (userType.value === 'individual' && individualProfile.value) {
    return individualProfile.value.birthdate;
  }
  if (userType.value === 'entrepreneur' && entrepreneurProfile.value) {
    return entrepreneurProfile.value.birthdate;
  }
  return undefined;
};

// Утилиты для форматирования
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
};

const getOrganizationType = (type: string | undefined) => {
  const types: Record<string, string> = {
    coop: 'Потребительский кооператив',
    prodcoop: 'Производственный кооператив',
    ooo: 'ООО',
  };
  return types[type || ''] || type || 'Не указан';
};

const getRepresentativeName = (representative: any) => {
  if (!representative) return '';
  const parts = [
    representative.last_name,
    representative.first_name,
    representative.middle_name,
  ].filter(Boolean);
  return parts.join(' ');
};
</script>

<style lang="scss" scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .profile-page {
    padding: var(--p-4, 16px);
  }
}
</style>
