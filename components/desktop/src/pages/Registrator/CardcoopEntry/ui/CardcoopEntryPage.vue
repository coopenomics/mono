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

      <!-- Пайщик: карта опознала, вход — штатными способами (сессий по карте не существует) -->
      <template v-else-if="entry.outcome === Zeus.CardcoopEntryOutcome.Member">
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
        <template v-if="entry.status === Zeus.CardcoopEntryStatus.Started && entry.memberships.length > 0">
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
        </template>

        <!-- Ждём решения держателя на card.coop -->
        <template v-else-if="entry.status === Zeus.CardcoopEntryStatus.AwaitingConsent">
          <div class="banner banner--info">
            <q-icon class="banner__icon" name="hourglass_top" />
            <div class="banner__body">
              Подтвердите перенос анкеты в кабинете card.coop — он открыт в вашем аккаунте
              карты. Эта страница продолжит сама, как только вы разрешите.
            </div>
          </div>
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

        <!-- Держатель отказал -->
        <template v-else>
          <div class="banner banner--info">
            <q-icon class="banner__icon" name="block" />
            <div class="banner__body">
              Перенос анкеты отклонён. Это не мешает вступлению — заполните анкету вручную.
            </div>
          </div>
          <BaseButton variant="primary" block @click="goSignUp">Заполнить анкету вручную</BaseButton>
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

const entryId = computed(() => String(route.query.entry ?? ''));
const failed = computed(() => Boolean(route.query.error) || !entryId.value);

const entry = ref<EntrySession | null>(null);
const selectedSource = ref<string | null>(null);
const requesting = ref(false);
const taking = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const title = computed(() => {
  if (failed.value) return 'Вход по карте';
  if (entry.value?.outcome === Zeus.CardcoopEntryOutcome.Member) return 'Мы вас узнали';
  return 'Быстрая регистрация по карте';
});
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
    if (session.status === Zeus.CardcoopEntryStatus.AwaitingConsent && !pollTimer) {
      pollTimer = setInterval(() => void load(), 3000);
    }
    if (session.status !== Zeus.CardcoopEntryStatus.AwaitingConsent && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  } catch {
    entry.value = null;
  }
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
    if (!pollTimer) pollTimer = setInterval(() => void load(), 3000);
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
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
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
