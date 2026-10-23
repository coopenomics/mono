<template>
  <div class="cardcoop-entry-page">
    <AuthSplit
      :eyebrow="coopTitle"
      :title="$t('registrator.cardcoopEntryPage.title')"
      :lead="$t('registrator.cardcoopEntryPage.lead')"
      :quote="$t('registrator.cardcoopEntryPage.quote')"
      :step-eyebrow="$t('registrator.cardcoopEntryPage.stepEyebrow')"
      :heading="title"
      :text="subtitle"
    >
      <template #actions>
        <AuthActions />
      </template>
      <!-- Ошибка входа: человек передумал на card.coop либо обмен не удался -->
      <template v-if="failed">
        <BaseBanner variant="info"> {{ $t('registrator.cardcoopEntryPage.failedHint') }} </BaseBanner>
        <div class="cardcoop-entry-page__actions">
          <BaseButton variant="primary" block @click="goSignIn">{{ $t('registrator.cardcoopEntryPage.signInNormalAction') }}</BaseButton>
          <BaseButton variant="secondary" block @click="goSignUp">{{ $t('registrator.cardcoopEntryPage.signUpAction') }}</BaseButton>
        </div>
      </template>

      <!-- Ответ сети ещё не пришёл: каркас той же формы, что и будущий экран -->
      <template v-else-if="!entry">
        <q-skeleton type="rect" height="72px" />
        <q-skeleton type="rect" height="40px" />
      </template>

      <!-- Карта опознала пайщика этого кооператива -->
      <template v-else-if="entry.username">
        <BaseBanner variant="info"> {{ $t('registrator.cardcoopEntryPage.recognizedPrefix') }} <span class="t-mono">{{ entry.username }}</span
          >{{ $t('registrator.cardcoopEntryPage.recognizedSuffix') }} </BaseBanner>
        <div class="cardcoop-entry-page__actions">
          <BaseButton variant="primary" block @click="goSignIn">{{ $t('registrator.cardcoopEntryPage.signInAction') }}</BaseButton>
          <BaseButton variant="secondary" block @click="goRecover">{{ $t('registrator.cardcoopEntryPage.recoverAccessAction') }}</BaseButton>
        </div>
      </template>

      <template v-else>
        <!-- Выбор кооператива-источника -->
        <template v-if="pickingSource && entry.memberships.length > 0">
          <BaseBanner variant="info"> {{ $t('registrator.cardcoopEntryPage.sourceSelectionHint') }} </BaseBanner>
          <div class="cardcoop-entry-page__sources">
            <label
              v-for="membership in entry.memberships"
              :key="membership.coopname"
              class="cardcoop-entry-page__source"
            >
              <q-radio v-model="selectedSource" :val="membership.coopname" dense />
              <span class="cardcoop-entry-page__source-name">{{ membership.displayName }}</span>
              <span v-if="membership.memberSince" class="cardcoop-entry-page__source-since"> {{ $t('registrator.cardcoopEntryPage.memberSincePrefix') }} {{ membership.memberSince }}
              </span>
            </label>
          </div>
          <div class="cardcoop-entry-page__actions">
            <BaseButton
              variant="primary"
              block
              :loading="requesting"
              :disabled="!selectedSource"
              @click="requestDisclosure"
            > {{ $t('registrator.cardcoopEntryPage.requestTransferAction') }} </BaseButton>
            <BaseButton variant="secondary" block @click="goSignUp">{{ $t('registrator.cardcoopEntryPage.fillManuallyAction') }}</BaseButton>
            <BaseButton variant="ghost" block @click="goSignIn">{{ $t('registrator.cardcoopEntryPage.haveAccountAction') }}</BaseButton>
          </div>
        </template>

        <!-- Членств нет: переносить неоткуда -->
        <template v-else-if="entry.status === Zeus.CardcoopEntryStatus.Started">
          <BaseBanner variant="info"> {{ $t('registrator.cardcoopEntryPage.noMembershipsHint') }} </BaseBanner>
          <div class="cardcoop-entry-page__actions">
            <BaseButton variant="primary" block @click="goSignUp">{{ $t('registrator.cardcoopEntryPage.continueSignUpAction') }}</BaseButton>
            <BaseButton variant="ghost" block @click="goSignIn">{{ $t('registrator.cardcoopEntryPage.haveAccountAction') }}</BaseButton>
          </div>
        </template>

        <!-- Ждём решения держателя на стороне сети -->
        <template v-else-if="entry.status === Zeus.CardcoopEntryStatus.AwaitingConsent">
          <BaseBanner variant="warn"> {{ $t('registrator.cardcoopEntryPage.awaitingConsentHint') }} </BaseBanner>
          <div class="cardcoop-entry-page__actions">
            <BaseButton variant="primary" block @click="openCardcoop">{{ $t('registrator.cardcoopEntryPage.openCardcoopAction') }}</BaseButton>
            <BaseButton variant="ghost" block @click="goSignUp">{{ $t('registrator.cardcoopEntryPage.skipWaitingAction') }}</BaseButton>
          </div>
        </template>

        <!-- Анкета пришла и проверена -->
        <template v-else-if="entry.status === Zeus.CardcoopEntryStatus.ProfileReady">
          <BaseBanner variant="pos"> {{ $t('registrator.cardcoopEntryPage.profileReadyHint') }} </BaseBanner>
          <div class="cardcoop-entry-page__actions">
            <BaseButton variant="primary" block :loading="taking" @click="continueWithProfile"> {{ $t('registrator.cardcoopEntryPage.continueWithProfileAction') }} </BaseButton>
          </div>
        </template>

        <!-- Перенос не состоялся: отказ, истёкшее согласие или сбой -->
        <template v-else>
          <BaseBanner variant="warn">{{ outcomeText }}</BaseBanner>
          <div class="cardcoop-entry-page__actions">
            <BaseButton variant="primary" block @click="goSignUp">{{ $t('registrator.cardcoopEntryPage.fillManuallyAction') }}</BaseButton>
            <BaseButton
              v-if="entry.memberships.length > 0"
              variant="secondary"
              block
              @click="pickAnotherSource"
            > {{ $t('registrator.cardcoopEntryPage.retryAction') }} </BaseButton>
          </div>
        </template>
      </template>
    </AuthSplit>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Queries, Mutations, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { FailAlert } from 'src/shared/api';
import { useRegistratorStore } from 'src/entities/Registrator';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';
import { useSystemStore } from 'src/entities/System/model';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import { t } from 'src/shared/i18n';

/**
 * Страница входа по карте кооператора (карта кооператора, story 9.2/9.3).
 *
 * Карта опознаёт, но не впускает: пайщика она ведёт к его учётной записи и штатному входу,
 * кандидата — в быструю регистрацию с переносом анкеты по согласию держателя. Страница
 * публичная: человек ещё не вошёл — он за этим и пришёл; право доступа к сессии — её
 * случайный идентификатор из адреса возврата card.coop.
 */
type EntrySession = Queries.Cardcoop.GetEntry.IOutput[typeof Queries.Cardcoop.GetEntry.name];

const route = useRoute();
const router = useRouter();
const registrator = useRegistratorStore();

const entry = ref<EntrySession | null>(null);
const selectedSource = ref<string | null>(null);
const requesting = ref(false);
const taking = ref(false);
/** Сессия не найдена или истекла: показываем то же, что и при сорванном входе. */
const gone = ref(false);

const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);
const entryId = computed(() => String(route.query.entry ?? ''));
const failed = computed(() => Boolean(route.query.error) || !entryId.value || gone.value);

/** Человек решил выбрать источник заново после отказа или неудачи. */
const retrying = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Сколько ждём решения держателя, прежде чем перестать опрашивать.
 *
 * Столько же живёт запрос на стороне сети: дольше ждать нечего — там он уже погас. Раньше
 * опрос шёл до закрытия вкладки, и «сайт завис» было единственным объяснением, которое
 * человек мог себе дать (3B5-54).
 */
const POLL_LIMIT_MS = 16 * 60 * 1000;
let pollStartedAt = 0;

const title = computed(() => {
  if (failed.value) return t('registrator.cardcoopEntryPage.titleFailed');
  if (entry.value?.username) return t('registrator.cardcoopEntryPage.titleRecognized');
  return t('registrator.cardcoopEntryPage.titleDefault');
});

/** Показывать ли выбор кооператива-источника: в начале либо по просьбе повторить. */
const pickingSource = computed(
  () => entry.value?.status === Zeus.CardcoopEntryStatus.Started || retrying.value,
);

/** Чем закончилась ветка переноса — тремя разными исходами, а не одним «отклонено». */
const outcomeText = computed(() => {
  if (entry.value?.status === Zeus.CardcoopEntryStatus.Denied)
    return t('registrator.cardcoopEntryPage.outcomeDenied');
  if (entry.value?.status === Zeus.CardcoopEntryStatus.Expired)
    return t('registrator.cardcoopEntryPage.outcomeExpired');
  return t('registrator.cardcoopEntryPage.outcomeFailed');
});

/**
 * Номер карты под заголовком.
 *
 * Разбивается по четыре ТОЛЬКО из цифр: сеть отдаёт номер уже с пробелами, и повторная
 * разбивка сдвигала группы — «9830 449 6 65 75 9 722» вместо «9830 4496 6575 9722»
 * (03.09.2026).
 */
const subtitle = computed(() => {
  const digits = (entry.value?.cardNumber ?? '').replace(/\D/g, '');
  return digits ? t('registrator.cardcoopEntryPage.subtitleCardNumber', { cardNumber: digits.replace(/(.{4})(?=.)/g, '$1 ') }) : undefined;
});

async function load(): Promise<void> {
  if (!entryId.value) return;
  try {
    const { [Queries.Cardcoop.GetEntry.name]: session } = await client.Query(Queries.Cardcoop.GetEntry.query, {
      variables: { data: { entry_id: entryId.value } },
    });
    entry.value = session;
    // Ожидание решения держателя: страница опрашивает сессию сама — грант приезжает
    // серверу, браузеру ничего не приходит.
    if (session.status === Zeus.CardcoopEntryStatus.AwaitingConsent) {
      retrying.value = false;
      startPolling();
    } else {
      stopPolling();
    }
  } catch {
    // Сессии нет либо она истекла. Прежде страница показывала вечный скелетон загрузки,
    // и человек ждал того, чего уже не существует (3B5-59).
    stopPolling();
    entry.value = null;
    gone.value = true;
  }
}

/** Начинает опрос, если он ещё не идёт. */
function startPolling(): void {
  if (pollTimer) return;
  pollStartedAt = Date.now();
  // timing: schedule — решение держателя карты принимается в другом кооперативе сети, гость ещё не вошёл и ленты у него нет; опрос ограничен сроком запроса
  pollTimer = setInterval(() => {
    if (Date.now() - pollStartedAt > POLL_LIMIT_MS) {
      // Сервер закроет сессию по тому же сроку; перестаём спрашивать и показываем исход.
      stopPolling();
      void load();
      return;
    }
    void load();
  }, 3000);
}

/** Останавливает опрос. */
function stopPolling(): void {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

/** Возвращает к выбору источника: отказ по одному кооперативу не закрывает перенос из другого. */
function pickAnotherSource(): void {
  selectedSource.value = null;
  retrying.value = true;
}

/** Уводит в кабинет карты — там держатель подтверждает перенос. */
function openCardcoop(): void {
  if (entry.value?.networkUrl) window.open(entry.value.networkUrl, '_blank', 'noopener');
}

async function requestDisclosure(): Promise<void> {
  if (!selectedSource.value) return;
  requesting.value = true;
  try {
    const { [Mutations.Cardcoop.RequestEntryDisclosure.name]: session } = await client.Mutation(
      Mutations.Cardcoop.RequestEntryDisclosure.mutation,
      { variables: { data: { entry_id: entryId.value, from_coopname: selectedSource.value } } },
    );
    entry.value = session;
    retrying.value = false;
    startPolling();
  } catch (error) {
    FailAlert(error);
  } finally {
    requesting.value = false;
  }
}

async function continueWithProfile(): Promise<void> {
  taking.value = true;
  try {
    const { [Mutations.Cardcoop.TakeEntryProfile.name]: taken } = await client.Mutation(
      Mutations.Cardcoop.TakeEntryProfile.mutation,
      { variables: { data: { entry_id: entryId.value } } },
    );
    registrator.applyCardcoopProfile(taken.subjectType, taken.profile as Record<string, unknown>);
    void router.push({ name: 'signup' });
  } catch (error) {
    FailAlert(error);
  } finally {
    taking.value = false;
  }
}

function goSignIn(): void {
  void router.push({ name: 'signin' });
}
function goRecover(): void {
  void router.push({ name: 'recover' });
}
function goSignUp(): void {
  void router.push({ name: 'signup' });
}

// realtime: нет источника — вход по карте кооператора делает гость до входа, лента доступна только вошедшему пайщику; ход переноса он узнаёт опросом с пределом (см. startPolling).
onMounted(() => void load());
onUnmounted(() => stopPolling());
</script>

<style scoped>
.cardcoop-entry-page {
  min-height: inherit;
}

.cardcoop-entry-page__sources {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.cardcoop-entry-page__source {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  padding: var(--p-2) var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  cursor: pointer;
}

.cardcoop-entry-page__source-name {
  flex: 1;
}

/* Кнопки формы — одной колонкой с ровным зазором, как на других экранах входа. */
.cardcoop-entry-page__actions {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.cardcoop-entry-page__source-since {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}
</style>
