<template lang="pug">
.profile-page(v-if='currentProfile')
  //- Удостоверение — одна форма: кто это (фото, имя, роль) и код, которым это
  //- проверяется. Раньше личность и удостоверение были двумя разными карточками,
  //- и предъявить их вместе было нечем.
  BaseCard(title='Удостоверение пайщика')
    .cert
      //- Левая колонка — профиль: сверху имя с фотографией, под ним всё остальное.
      //- Панель идёт без рамки: своя рамка внутри карточки читается как «карточка
      //- в карточке» и делит на части то, что является одним целым.
      .cert__main
        IdentityPanel.cert__person(:identity='identity', flat)

        //- Строки удостоверения оформлены одинаково, как везде на странице: слева
        //- подпись, справа значение. Раньше цепочка и уровень были самодельными
        //- блоками и выбивались из общего строя.
        //- Пока удостоверение едет с сервера, на его месте стоит каркас той же
        //- формы. Раньше здесь на секунду появлялось «Удостоверение ещё не
        //- выпущено» — пайщик успевал прочитать, что удостоверения у него нет,
        //- и только потом оно возникало.
        template(v-if='certLoading')
          DataRow(label='Цепочка подписей')
            template(#value-override)
              q-skeleton(type='QChip', width='180px')
          DataRow(label='Уровень верификации')
            template(#value-override)
              q-skeleton(type='QChip', width='96px')

        template(v-else-if='certificate')
          DataRow(label='Цепочка подписей')
            template(#value-override)
              .cert__chain-cell
                .cert__chips
                  template(v-for='(step, i) in chainSteps', :key='i')
                    BaseChip(:variant='step.variant') {{ step.label }}
                    q-icon.cert__chain-arrow(
                      v-if='i < chainSteps.length - 1',
                      name='arrow_forward',
                      size='16px'
                    )
                .cert__warn(v-if='!isEndorsed') Удостоверение не утверждено АНО
          DataRow(v-if='verificationLabels.length', label='Уровень верификации')
            template(#value-override)
              .cert__chips
                BaseChip(
                  v-for='(label, i) in verificationLabels',
                  :key='i',
                  variant='info'
                ) {{ label }}

      //- Код — справа, отдельной колонкой: его предъявляют, а не читают.
      .cert__qr(v-if='certLoading')
        q-skeleton(type='rect', width='112px', height='112px')
        q-skeleton(type='text', width='88px')

      .cert__qr(v-else-if='certificate')
        CertificateQr(:jws='certificate.jws', :size='112')
        BaseButton(variant='ghost', size='sm', @click='openQr')
          template(#icon-left)
            q-icon(name='fullscreen', size='18px')
          | Показать

    //- Прежний текст звал войти в кооператив — но карточка видна только тому, кто
    //- уже вошёл, и совет читался как издевательство. Удостоверение выпускается
    //- на входе и требует ключей заверения кооператива; если их нет, войти можно,
    //- а удостоверения не будет.
    EmptyState(
      v-if='!certLoading && !certificate',
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
      //- Годность кода: проверяющий должен видеть, что предъявляемое свежее, а
      //- предъявляющий — сколько у него осталось времени.
      .cert-show__validity
        span.cert-show__until Годен до {{ validUntil }}
        span.cert-show__left(:class='{ "cert-show__left--low": secondsLeft <= 60 }') {{ countdown }}
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
import { decodeTrustChain } from '@coopenomics/auth';
import { fetchParticipantCertificate } from '../api';
import type { ParticipantCertificate } from '../api';

const session = useSessionStore();
const system = useSystemStore();

// ── Криптографическое удостоверение пайщика (CoopID, Story 1.9) ──
const certificate = ref<ParticipantCertificate | null>(null);
// Отдельно от `certificate`: пустое удостоверение и ещё не приехавшее — разные
// состояния, и путать их нельзя. Пока запрос в пути, показываем каркас, а не
// «удостоверения нет».
const certLoading = ref(true);

onMounted(async () => {
  // Best-effort: отсутствие удостоверения (старый контур входа / сбой) не должно
  // ломать страницу профиля — карточка просто покажет EmptyState.
  try {
    certificate.value = await fetchParticipantCertificate();
  } catch {
    certificate.value = null;
  } finally {
    certLoading.value = false;
  }
});

// Человекочитаемые имена звеньев цепи подписей + сам пайщик в конце.
// Имена кооперативов не перечисляем списком: свой берём из настроек кооператива,
// чужие показываем как есть. Прежний список знал ровно два имени и на любом другом
// кооперативе показал бы чужие названия.
/** Якорь доверия сети: с него обязана начинаться цепочка подписей. */
const TRUST_ANCHOR_ACCOUNT = 'ano';

// Полное имя, а не аббревиатура: рядом стоит «ПК Восход», и «АНО» одиноким
// сокращением читалось бы как обрезанное название.
const CHAIN_LABELS: Record<string, string> = {
  [TRUST_ANCHOR_ACCOUNT]: 'АНО Кооперативная Экономика',
};
function chainLabel(account: string): string {
  if (CHAIN_LABELS[account]) return CHAIN_LABELS[account];
  if (account === system.info.coopname) return system.cooperativeDisplayName || account;
  return account;
}
/**
 * Утверждено ли удостоверение корнем доверия. Цепочка обязана начинаться с АНО: она
 * заверяет операторов, те — кооперативы, кооперативы — пайщиков. Без корня кооператив
 * оказывается сам себе и издателем, и подтверждающим, а такое подтверждение ничего
 * не стоит.
 *
 * Здесь читается только имя заверяющего в первом звене — подпись не проверяется.
 * Настоящую проверку делает считыватель у проверяющего единственной реализацией;
 * вторая, ради надписи на экране, однажды разошлась бы с первой и начала уверять
 * пайщика в том, чего проверяющий не подтверждает.
 */
const trustChain = computed(() => decodeTrustChain(certificate.value?.trust_chain ?? []));
const isEndorsed = computed(() => trustChain.value[0]?.issuer === TRUST_ANCHOR_ACCOUNT);

/**
 * Цепочка целиком одного цвета: зелёная, когда удостоверение утверждено, красная,
 * когда нет. Половинчатой раскраски здесь быть не может — цепь либо ведёт к якорю,
 * либо не ведёт, и промежуточных состояний у доверия нет.
 */
const chainSteps = computed<{ label: string; variant: BaseChipVariant }[]>(() => {
  const variant: BaseChipVariant = isEndorsed.value ? 'pos' : 'neg';
  const links = trustChain.value;
  // Первое звено называет и заверяющего, и заверённого; дальше каждое добавляет
  // только заверённого — иначе имена шли бы парами и повторялись.
  const names = links.length ? [links[0].issuer, ...links.map((l) => l.subject)] : [];
  return [...names.map((n) => ({ label: chainLabel(n), variant })), { label: 'Вы', variant }];
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


// Показ удостоверения. Скачивания намеренно нет: удостоверение несёт персональные
// данные, и файл, однажды покинувший приложение, дальше ходит сам по себе. Показать
// с экрана достаточно — проверяющий сканирует код и получает всё, что ему нужно.
const showQr = ref(false);
const qrShowSize = ref(320);

// ── Годность показанного кода ────────────────────────────────────────────────
// Код годен ограниченное время, и это единственная величина, которую проверяющему
// важно видеть рядом с самим кодом: свежий он или уже просрочен. Пайщику тот же
// счётчик отвечает на вопрос «успею ли дойти».
const now = ref(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;

const secondsLeft = computed(() => {
  const exp = (certificate.value?.exp ?? 0) * 1000;
  if (!exp) return 0;
  return Math.max(0, Math.floor((exp - now.value) / 1000));
});

const validUntil = computed(() => {
  const exp = (certificate.value?.exp ?? 0) * 1000;
  if (!exp) return '';
  return new Date(exp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
});

const countdown = computed(() => {
  const left = secondsLeft.value;
  if (left <= 0) return 'обновляем…';
  const m = Math.floor(left / 60);
  const sec = left % 60;
  return `осталось ${m}:${String(sec).padStart(2, '0')}`;
});

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
  startTicking();
}

/**
 * Счётчик идёт, только пока код на экране: держать его постоянно незачем, а по
 * исчерпании годности удостоверение перевыпрашивается сразу — иначе пайщик стоит
 * перед проверяющим с кодом, который уже не примут.
 */
function startTicking(): void {
  if (tick) return;
  now.value = Date.now();
  tick = setInterval(() => {
    now.value = Date.now();
    if (secondsLeft.value <= 0) void renewCertificate();
  }, 1000);
}

function stopTicking(): void {
  if (tick) clearInterval(tick);
  tick = null;
}

let renewing = false;
async function renewCertificate(): Promise<void> {
  if (renewing) return;
  renewing = true;
  try {
    certificate.value = await fetchParticipantCertificate();
  } catch {
    // Сеть недоступна — оставляем прежний код и счётчик на нуле: врать «годен»
    // нельзя, а показать нечего.
  } finally {
    renewing = false;
  }
}

watch(showQr, (open) => {
  if (!open) stopTicking();
});

onBeforeUnmount(stopTicking);

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




.cert__chain,

.cert__chain-arrow {
  color: var(--p-ink-3);
}

.cert {
  display: flex;
  align-items: flex-start;
  gap: var(--p-5);
}
.cert__main {
  flex: 1;
  min-width: 0;
}
/* Имя отделено от строк удостоверения: без отступа «Председатель совета» и подпись
   первой строки слипались в один абзац и читались как продолжение друг друга. */
.cert__person {
  margin-bottom: var(--p-4);
}
.cert__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-2);
  flex: none;
}
/* Значения-чипы в строках: цепочка подписей и уровень верификации выровнены по
   правому краю так же, как обычные значения соседних строк. */
.cert__chips {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}
/* На узком экране код уходит под профиль: рядом он сжимает имя до нечитаемого. */
@media (max-width: 599px) {
  .cert {
    flex-direction: column;
    align-items: stretch;
  }
  .cert__qr {
    align-items: flex-start;
  }
  .cert__chips {
    justify-content: flex-start;
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
.cert-show__validity {
  display: flex;
  align-items: baseline;
  gap: var(--p-3);
  margin-top: var(--p-2);
}
.cert-show__until {
  color: var(--p-ink-2);
}
.cert-show__left {
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
/* Последняя минута — предупреждением: успеть показать или дождаться перевыпуска. */
.cert-show__left--low {
  color: var(--p-warn);
}
.cert__chain-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-1);
}
/* Неутверждённое удостоверение — красным и словами: цепочка из одного звена
   выглядит как обычная, и без надписи её несостоятельность не видна. */
.cert__warn {
  font-size: var(--p-fs-body-sm);
  color: var(--p-neg);
}
@media (max-width: 599px) {
  .cert__chain-cell {
    align-items: flex-start;
  }
}

.cert-show__hint {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

@media (max-width: 768px) {
  .profile-page {
    padding: var(--p-4, 16px);
  }
}
</style>
