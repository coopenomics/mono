<template>
  <div class="cardcoop-entry-page">
    <AuthCard :title="title" :subtitle="subtitle">
      <!-- Ошибка входа: человек передумал на card.coop либо обмен не удался -->
      <template v-if="failed">
        <div class="banner banner--info">
          <q-icon class="banner__icon" name="info" />
          <div class="banner__body">
            Вход по карте не завершился. Ничего не потеряно: войдите обычным способом или
            зарегистрируйтесь — карту можно будет связать позже.
          </div>
        </div>
        <BaseButton variant="primary" block @click="goSignIn">Войти обычным способом</BaseButton>
        <BaseButton variant="secondary" block @click="goSignUp">Зарегистрироваться</BaseButton>
      </template>

      <!-- Сессия грузится -->
      <template v-else-if="!entry">
        <div class="skel" />
        <div class="skel" />
      </template>

      <!-- Карта опознала человека: учётная запись у него уже есть. Вход — штатными
           способами, сессий по карте не существует. Ветка общая и для пайщика, и для
           кандидата, ждущего решения совета: вторая учётная запись ему ни к чему (3B5-53). -->
      <template v-else-if="entry.username">
        <div class="banner banner--info">
          <q-icon class="banner__icon" name="badge" />
          <div class="banner__body">
            Карта опознала вас: учётная запись
            <span class="t-mono">{{ entry.username }}</span
            >. Войдите паролем — или восстановите доступ, если пароль утерян.
          </div>
        </div>
        <BaseButton variant="primary" block @click="goSignIn">Войти</BaseButton>
        <BaseButton variant="secondary" block @click="goRecover">Восстановить доступ</BaseButton>
      </template>

      <!-- Кандидат: быстрая регистрация -->
      <template v-else>
        <!-- Выбор кооператива-источника -->
        <template v-if="pickingSource && entry.memberships.length > 0">
          <div class="banner banner--info">
            <q-icon class="banner__icon" name="badge" />
            <div class="banner__body">
              Анкету можно перенести из кооператива, где вас уже верифицировали, — с вашего
              согласия и напрямую, минуя сеть. Выберите кооператив-источник.
            </div>
          </div>
          <div class="cardcoop-entry-page__sources">
            <label
              v-for="membership in entry.memberships"
              :key="membership.coopname"
              class="cardcoop-entry-page__source"
            >
              <q-radio v-model="selectedSource" :val="membership.coopname" dense />
              <span class="cardcoop-entry-page__source-name">{{ membership.displayName }}</span>
              <span v-if="membership.memberSince" class="t-sm t-muted">
                пайщик с {{ membership.memberSince }}
              </span>
            </label>
          </div>
          <BaseButton
            variant="primary"
            block
            :loading="requesting"
            :disabled="!selectedSource"
            @click="requestDisclosure"
          >
            Запросить перенос анкеты
          </BaseButton>
          <BaseButton variant="ghost" block @click="goSignUp">Заполнить анкету вручную</BaseButton>
          <BaseButton variant="ghost" block @click="goSignIn">У меня уже есть учётная запись</BaseButton>
        </template>

        <!-- Членств нет: обычная регистрация, карта свяжется по её ходу -->
        <template v-else-if="entry.status === Zeus.CardcoopEntryStatus.Started">
          <div class="banner banner--info">
            <q-icon class="banner__icon" name="badge" />
            <div class="banner__body">
              У карты пока нет подтверждённых членств — анкету перенести неоткуда.
              Зарегистрируйтесь обычным порядком: карта будет связана по ходу вступления.
            </div>
          </div>
          <BaseButton variant="primary" block @click="goSignUp">Продолжить регистрацию</BaseButton>
          <BaseButton variant="ghost" block @click="goSignIn">У меня уже есть учётная запись</BaseButton>
        </template>

        <!-- Ждём решения держателя на card.coop -->
        <template v-else-if="entry.status === Zeus.CardcoopEntryStatus.AwaitingConsent">
          <div class="banner banner--info">
            <q-icon class="banner__icon" name="hourglass_top" />
            <div class="banner__body">
              Откройте кабинет card.coop и подтвердите перенос анкеты. Эта страница продолжит
              сама, как только вы разрешите.
            </div>
          </div>
          <BaseButton variant="primary" block @click="openCardcoop">Открыть card.coop</BaseButton>
          <div class="skel" />
          <BaseButton variant="ghost" block @click="goSignUp">Не ждать — заполнить вручную</BaseButton>
        </template>

        <!-- Анкета приехала -->
        <template v-else-if="entry.status === Zeus.CardcoopEntryStatus.ProfileReady">
          <div class="banner banner--info">
            <q-icon class="banner__icon" name="task_alt" />
            <div class="banner__body">
              Анкета получена от кооператива и подписана его ключом. Проверьте данные в форме
              вступления, подпишите заявление и оплатите взнос — совет рассмотрит его обычным
              порядком.
            </div>
          </div>
          <BaseButton variant="primary" block :loading="taking" @click="continueWithProfile">
            Продолжить с перенесённой анкетой
          </BaseButton>
        </template>

        <!-- Ветка закончилась без анкеты: отказ, молчание либо неудавшийся перенос.
             У каждой из трёх есть конец и понятный следующий шаг (3B5-54). -->
        <template v-else>
          <div class="banner banner--info">
            <q-icon class="banner__icon" :name="outcomeIcon" />
            <div class="banner__body">{{ outcomeText }}</div>
          </div>
          <BaseButton variant="primary" block @click="goSignUp">Заполнить анкету вручную</BaseButton>
          <BaseButton
            v-if="entry.memberships.length > 0"
            variant="secondary"
            block
            @click="pickAnotherSource"
          >
            Попробовать ещё раз
          </BaseButton>
        </template>
      </template>
    </AuthCard>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Queries, Mutations, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { FailAlert } from 'src/shared/api';
import { useRegistratorStore } from 'src/entities/Registrator';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import { BaseButton } from 'src/shared/ui/base';

/**
 * Страница входа по карте пайщика (карта пайщика, story 9.2/9.3).
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
  if (failed.value) return 'Вход по карте';
  if (entry.value?.username) return 'Мы вас узнали';
  return 'Быстрая регистрация по карте';
});

/** Показывать ли выбор кооператива-источника: в начале либо по просьбе повторить. */
const pickingSource = computed(
  () => entry.value?.status === Zeus.CardcoopEntryStatus.Started || retrying.value,
);

/** Чем закончилась ветка переноса — тремя разными исходами, а не одним «отклонено». */
const outcomeText = computed(() => {
  if (entry.value?.status === Zeus.CardcoopEntryStatus.Denied)
    return 'Перенос анкеты отклонён. Это не мешает вступлению — заполните анкету вручную.';
  if (entry.value?.status === Zeus.CardcoopEntryStatus.Expired)
    return 'Согласие не подтверждено вовремя — запрос погас. Можно попросить заново или заполнить анкету вручную.';
  return 'Перенести анкету не удалось. Можно попробовать ещё раз или заполнить её вручную — на вступление это не влияет.';
});

const outcomeIcon = computed(() =>
  entry.value?.status === Zeus.CardcoopEntryStatus.Denied ? 'block' : 'schedule',
);
const subtitle = computed(() =>
  entry.value?.cardNumber ? `Карта ${entry.value.cardNumber.replace(/(.{4})(?=.)/g, '$1 ')}` : undefined,
);

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

onMounted(() => void load());
onUnmounted(() => stopPolling());
</script>

<style scoped>
.cardcoop-entry-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6);
  min-height: 100%;
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

.skel {
  height: 48px;
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
</style>
