<template lang="pug">
.profile-page(v-if='currentProfile')
  //- Удостоверение — одна форма: кто это (фото, имя, роль) и код, которым это
  //- проверяется. Раньше личность и удостоверение были двумя разными карточками,
  //- и предъявить их вместе было нечем.
  BaseCard(title='Удостоверение пайщика')
    .cert__identity
      IdentityPanel.cert__person(:identity='identity')
      .cert__qr(v-if='certificate')
        CertificateQr(:jws='certificate.jws', :size='112')
        BaseButton(variant='ghost', size='sm', @click='openQr')
          template(#icon-left)
            q-icon(name='fullscreen', size='18px')
          | Показать

    template(v-if='certificate')
      //- Серийный номер убран: пайщику он ни о чём не говорит, а проверяющий читает
      //- его из кода. Состояние стоит рядом со сроком — это про один и тот же факт.
      DataRow(label='Действует до')
        template(#value-override)
          .cert__validity
            span {{ formatExp(certificate.exp) }}
            BaseChip(:variant='certStatus.variant') {{ certStatus.label }}

      .cert__block
        .cert__block-label Цепочка подписей
        .cert__chain
          template(v-for='(step, i) in chainSteps', :key='i')
            BaseChip(:variant='step.variant') {{ step.label }}
            q-icon.cert__chain-arrow(
              v-if='i < chainSteps.length - 1',
              name='arrow_forward',
              size='16px'
            )

      .cert__block(v-if='verificationLabels.length')
        .cert__block-label Уровень верификации
        .cert__verifications
          BaseChip(
            v-for='(label, i) in verificationLabels',
            :key='i',
            variant='info'
          ) {{ label }}

    //- Прежний текст звал войти в кооператив — но карточка видна только тому, кто
    //- уже вошёл, и совет читался как издевательство. Удостоверение выпускается
    //- на входе и требует ключей заверения кооператива; если их нет, войти можно,
    //- а удостоверения не будет.
    EmptyState(
      v-else,
      title='Удостоверение ещё не выпущено',
      body='Кооператив пока не может заверить удостоверение. Оно появится здесь автоматически, как только заверение станет доступно.'
    )

  //- Показ во весь экран: код должен читаться сканером с чужого устройства, а
  //- рядом — имя, чтобы предъявление было осмысленным без пояснений.
  BaseDialog(v-model='showQr', maximized)
    .cert-show(v-if='certificate')
      CertificateQr.cert-show__qr(:jws='certificate.jws', :size='qrShowSize')
      .cert-show__name {{ identity.fullName }}
      .cert-show__meta {{ system.cooperativeDisplayName || certificate.coopname }}
      .cert-show__hint Поднесите код к сканеру проверяющего

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
import { useSystemStore } from 'src/entities/System/model';
import type {
  IEntrepreneurData,
  IIndividualData,
  IOrganizationData,
} from 'src/shared/lib/types/user/IUserData';
import { computed, onMounted, ref } from 'vue';
import { useDisplayName } from 'src/shared/lib/composables/useDisplayName';
import { IdentityPanel } from 'src/shared/ui/domain/IdentityPanel';
import type { Identity } from 'src/shared/ui/domain/IdentityPanel';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import type { BaseChipVariant } from 'src/shared/ui/base/BaseChip';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { CertificateQr } from 'src/features/User/ShowCertificate';
import { fetchParticipantCertificate } from '../api';
import type { ParticipantCertificate } from '../api';

const session = useSessionStore();
const system = useSystemStore();

// ── Криптографическое удостоверение пайщика (CoopID, Story 1.9) ──
const certificate = ref<ParticipantCertificate | null>(null);

onMounted(async () => {
  // Best-effort: отсутствие удостоверения (старый контур входа / сбой) не должно
  // ломать страницу профиля — карточка просто покажет EmptyState.
  try {
    certificate.value = await fetchParticipantCertificate();
  } catch {
    certificate.value = null;
  }
});

/**
 * Состояние удостоверения. Промежуточного «истекает» здесь нет намеренно: окно
 * предупреждения совпадало со всем сроком жизни, поэтому оранжевое «Истекает»
 * горело всегда и пугало на пустом месте. Удостоверение выпускается заново при
 * каждом открытии страницы, так что приближение срока — не событие для пайщика.
 */
const certStatus = computed<{ label: string; variant: BaseChipVariant }>(() => {
  const exp = (certificate.value?.exp ?? 0) * 1000;
  if (!exp || Date.now() >= exp) return { label: 'Истекло', variant: 'neg' };
  return { label: 'Действует', variant: 'pos' };
});

// Человекочитаемые имена звеньев цепи подписей + сам пайщик в конце.
// Имена кооперативов не перечисляем списком: свой берём из настроек кооператива,
// чужие показываем как есть. Прежний список знал ровно два имени и на любом другом
// кооперативе показал бы чужие названия.
const CHAIN_LABELS: Record<string, string> = {
  ano: 'АНО',
};
function chainLabel(account: string): string {
  if (CHAIN_LABELS[account]) return CHAIN_LABELS[account];
  if (account === system.info.coopname) return system.cooperativeDisplayName || account;
  return account;
}
const chainSteps = computed<{ label: string; variant: BaseChipVariant }[]>(() => {
  const links = (certificate.value?.coop_chain ?? []).map((l) => ({
    label: chainLabel(l.account),
    variant: 'neutral' as BaseChipVariant,
  }));
  return [...links, { label: 'Вы', variant: 'accent' as BaseChipVariant }];
});

// Описания типов верификации (зеркало @coopenomics/auth.verificationTypeLabel).
// Уровни верификации: сейчас есть только базовый — членство подтверждено самим
// кооперативом. Дальше добавятся уровни, подтверждённые документами.
const VERIFICATION_LABELS: Record<string, string> = {
  coop_baseline: 'Базовый',
};
// Структурная форма claim (Story 4.3): отображаем лейбл по типу; verified_at/source —
// в UI пока не выводим (отдельная verstka-история).
const verificationLabels = computed(() =>
  (certificate.value?.verification_types ?? []).map((e) => VERIFICATION_LABELS[e.type] ?? e.type),
);

const formatExp = (exp: number): string => {
  if (!exp) return '';
  return new Date(exp * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Показ удостоверения. Скачивания намеренно нет: удостоверение несёт персональные
// данные, и файл, однажды покинувший приложение, дальше ходит сам по себе. Показать
// с экрана достаточно — проверяющий сканирует код и получает всё, что ему нужно.
const showQr = ref(false);
const qrShowSize = ref(320);

/**
 * Размер кода на весь экран считаем по меньшей стороне — чтобы влезал и в портрет,
 * и в ландшафт. Пересчитываем при каждом открытии: экран могли повернуть, а
 * вычисленное однажды значение так и осталось бы от прежней ориентации.
 */
function openQr(): void {
  if (typeof window !== 'undefined') {
    qrShowSize.value = Math.min(Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.7), 520);
  }
  showQr.value = true;
}

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

.cert__head {
  margin-bottom: var(--p-3, 12px);
}

.cert__block {
  margin-top: var(--p-4, 16px);
}

.cert__block-label {
  margin-bottom: var(--p-2, 8px);
  color: var(--p-ink-3);
  font-size: var(--p-fs-sm, 13px);
}

.cert__chain,
.cert__verifications {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2, 8px);
}

.cert__chain-arrow {
  color: var(--p-ink-3);
}

.cert__identity {
  display: flex;
  /* По центру, а не по верху: колонка с кодом выше панели личности, и при
     выравнивании по верху под именем зиял пустой блок в половину экрана. */
  align-items: center;
  gap: var(--p-4);
}
.cert__validity {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}
.cert__person {
  flex: 1;
  min-width: 0;
}
.cert__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-2);
  flex: none;
}
/* На узком экране код уходит под имя: рядом он сжимает ФИО до нечитаемого. */
@media (max-width: 599px) {
  .cert__identity {
    flex-direction: column;
    align-items: stretch;
  }
  .cert__qr {
    align-items: flex-start;
  }
}

.cert-show {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--p-3);
  min-height: 70vh;
  text-align: center;
}
.cert-show__name {
  font-size: var(--p-fs-h4, 20px);
  font-weight: 600;
  color: var(--p-ink);
  margin-top: var(--p-2);
}
.cert-show__meta {
  color: var(--p-ink-2);
}
.cert-show__hint {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
.cert__actions {
  margin-top: var(--p-4, 16px);
}

@media (max-width: 768px) {
  .profile-page {
    padding: var(--p-4, 16px);
  }
}
</style>
