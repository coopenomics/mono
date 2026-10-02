<template lang="pug">
.participant-page
  //- Липкий бар с возвратом в реестр — виден при прокрутке длинной анкеты.
  .participant-page__bar
    button.participant-page__back(type='button', @click='goBack')
      q-icon(name='arrow_back', size='18px')
      span {{ $t('participants.participantDetailsPage.backLabel') }}

  .participant-page__content
    template(v-if='loading')
      q-skeleton.q-mb-md(type='rect', height='96px')
      q-skeleton(type='rect', height='320px')

    template(v-else-if='participant')
      IdentityPanel.q-mb-lg(:identity='identity')
        template(#actions)
          BaseBadge(:variant='status.variant') {{ status.label }}

      ParticipantDetails(
        :key='participant.username',
        :participant='participant',
        :naming='naming',
        @update='() => load(true)',
        @verification-changed='() => load(true)'
      )

    EmptyState(
      v-else,
      :title='$t("participants.participantDetailsPage.notFoundTitle")',
      :body='$t("participants.participantDetailsPage.notFoundBody")'
    )
      template(#icon)
        q-icon(name='person_off', size='48px')
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAccountStore, getAccountStatusBadge } from 'src/entities/Account';
import type { IAccount } from 'src/entities/Account/types';
import { useDesktopStore } from 'src/entities/Desktop';
import { ParticipantDetails, PARTICIPANT_LIVE_TABLES, useVerificationNaming } from 'src/widgets/Participants';
import { BaseBadge, EmptyState } from 'src/shared/ui/base';
import { IdentityPanel, type Identity } from 'src/shared/ui/domain/IdentityPanel';
import { FailAlert } from 'src/shared/api';
import { getName } from 'src/shared/lib/utils';
import { useLiveReload } from 'src/shared/lib/realtime';
import { t } from 'src/shared/i18n';

/**
 * Страница пайщика в столе совета. Сюда ведут кнопка «Открыть страницу» в
 * правой панели реестра и находка «пайщик» из единого поиска. Содержимое то
 * же, что в панели, — верификация, второй фактор, сведения при вступлении и
 * анкета, — плюс шапка с именем и статусом.
 */
const route = useRoute();
const router = useRouter();
const accountStore = useAccountStore();
const desktopStore = useDesktopStore();

const username = computed(() => String(route.params.username ?? ''));
const participant = ref<IAccount | null>(null);
const loading = ref(true);

const naming = useVerificationNaming(() => (participant.value ? [participant.value] : []));

const identity = computed<Identity>(() => ({
  fullName: participant.value ? getName(participant.value) || participant.value.username : '',
  accountName: participant.value?.username,
  email: participant.value?.provider_account?.email || undefined,
}));

const status = computed(() =>
  participant.value
    ? getAccountStatusBadge(participant.value)
    : { label: '', variant: 'neutral' as const },
);

const load = async (silent = false): Promise<void> => {
  if (!username.value) return;
  if (!silent) loading.value = true;
  try {
    participant.value = (await accountStore.fetchAccount(username.value)) ?? null;
  } catch (e: any) {
    // Фоновое перечитывание не пугает отказом: следующий сигнал повторит.
    if (!silent) FailAlert(e);
  } finally {
    loading.value = false;
  }
};

const goBack = (): void => {
  void router.push({ name: 'participants', params: { coopname: route.params.coopname } });
};

// Вступление, взнос, блокировка, выход, сверка личности и правка анкеты
// меняют эти таблицы — открытая страница перечитывается сама.
useLiveReload(PARTICIPANT_LIVE_TABLES, () => load(true));

// Переход с одного пайщика на другого (из поиска) не пересоздаёт страницу —
// перечитываем по новому имени.
watch(username, () => load(), { immediate: true });

// Имя пайщика — в заголовок шапки, пока открыта страница.
watch(
  () => (participant.value ? identity.value.fullName : t('participants.participantDetailsPage.defaultTitle')),
  (title) => desktopStore.setPageTitleOverride(title),
  { immediate: true },
);

onUnmounted(() => desktopStore.clearPageTitleOverride());
</script>

<style lang="scss" scoped>
/* Липкий бар во всю ширину; top — высота фиксированного топбара. */
.participant-page__bar {
  position: sticky;
  top: var(--p-topbar-h, 56px);
  z-index: 2;
  background: var(--p-canvas);
  border-bottom: 1px solid var(--p-line);
  padding: var(--p-3) var(--p-6);
}

.participant-page__content {
  max-width: 880px;
  padding: var(--p-6);
}

.participant-page__back {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  font-family: inherit;
  font-size: var(--p-fs-body-sm);
  cursor: pointer;
  transition: color var(--p-dur-fast) var(--p-ease-standard);
}
.participant-page__back:hover {
  color: var(--p-ink);
}

@media (max-width: 768px) {
  .participant-page__bar {
    padding: var(--p-3) var(--p-4);
  }
  .participant-page__content {
    padding: var(--p-4);
  }
}
</style>
