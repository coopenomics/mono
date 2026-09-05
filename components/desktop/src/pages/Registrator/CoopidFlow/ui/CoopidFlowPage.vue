<template lang="pug">
.coopid-flow-page
  AuthCard(:title='title', :subtitle='subtitle', :max-width='480')
    template(v-if='runner.state.value === FlowState.Starting')
      p.flow-stage__lead Открываем вход…

    template(v-else-if='runner.state.value === FlowState.Leaving')
      p.flow-stage__lead Завершаем…

    template(v-else-if='runner.state.value === FlowState.Broken')
      BaseBanner(variant='neg')
        strong Вход не отвечает.
        |  {{ runner.failure.value ?? 'Попробуйте ещё раз через минуту.' }}
      .flow-stage__actions
        BaseButton(variant='primary', @click='begin') Попробовать снова

    template(v-else-if='unknownStage')
      BaseBanner(variant='neg')
        strong Этот шаг входа стол ещё не умеет показывать.
        |  Сообщите нам — добавим; пока войдите другим способом.
      .flow-stage__actions
        BaseButton(variant='primary', @click='begin') Начать заново

    template(v-else)
      BaseBanner(v-if='runner.failure.value', variant='neg') {{ runner.failure.value }}
      template(v-if='current')
        FlowIdentification(
          v-if='stage === FlowStage.Identification',
          :challenge='current',
          :sending='runner.sending.value',
          @answer='runner.answer',
          @flow='openFlow',
          @source='runner.take'
        )
        FlowPassword(
          v-else-if='stage === FlowStage.Password',
          :challenge='current',
          :sending='runner.sending.value',
          @answer='runner.answer',
          @flow='openFlow',
          @restart='runner.restart'
        )
        FlowPrompt(v-else-if='stage === FlowStage.Prompt', :challenge='current', :sending='runner.sending.value', @answer='runner.answer')
        FlowEmail(v-else-if='stage === FlowStage.Email', :challenge='current', :sending='runner.sending.value', :slug='slug', @answer='runner.answer')
        FlowCode(
          v-else-if='stage === FlowStage.AuthenticatorEmail || stage === FlowStage.AuthenticatorValidate',
          :challenge='current',
          :sending='runner.sending.value',
          @answer='runner.answer'
        )
        FlowConsent(v-else-if='stage === FlowStage.Consent', :challenge='current', :sending='runner.sending.value', @answer='runner.answer')
        FlowAutosubmit(v-else-if='stage === FlowStage.Autosubmit', :challenge='current')
        FlowSessionEnd(v-else-if='stage === FlowStage.SessionEnd', :challenge='current', @leave='leave')
        FlowDenied(
          v-else-if='stage === FlowStage.Denied || stage === FlowStage.Failed',
          :challenge='current',
          :denied='stage === FlowStage.Denied',
          :entered='entered',
          @leave='leave'
        )
</template>

<script lang="ts" setup>
/**
 * Экраны потоков CoopID (задача 105-30): вход, согласие, код, отказ — своими компонентами.
 *
 * Стол ведёт человека по потоку authentik, но показывает его сам: та же карточка, что у
 * входа и регистрации, те же поля и кнопки. Аутентификация целиком остаётся у authentik —
 * стол только спрашивает у него очередной шаг и отвечает. Родные адреса `/if/flow/<slug>/`
 * возвращает сюда nginx стенда (infra/coopid/nginx). Подход перенесён из карты кооператора
 * (card.coop, ADR-0003).
 */
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { AuthCard } from 'src/shared/ui/domain';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import { FlowStage, hasIdpSession } from 'src/shared/api/authentik-flow';
import { FlowState, createFlowRunner, type FlowRunner } from 'src/features/CoopidFlow/model/flow-runner';
import {
  FlowAutosubmit,
  FlowCode,
  FlowConsent,
  FlowDenied,
  FlowEmail,
  FlowIdentification,
  FlowPassword,
  FlowPrompt,
  FlowSessionEnd,
} from 'src/features/CoopidFlow/ui';

const route = useRoute();
const router = useRouter();
const system = useSystemStore();

const slug = computed(() => String(route.params.slug ?? ''));
const next = computed(() => (typeof route.query.next === 'string' ? route.query.next : ''));

/** Строка запроса потока целиком: в ней `next` и токены из писем. */
const query = computed(() => {
  const pairs = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') pairs.set(key, value);
  }
  return pairs.toString();
});

/** authentik стенда живёт на том же имени (nginx развозит /api/v3 → authentik). */
const BASE = '';

const runner = shallowRef<FlowRunner>(createFlowRunner(BASE, slug.value, query.value));
const stage = computed(() => runner.value.challenge.value?.component ?? null);
const current = computed(() => runner.value.challenge.value);

/** Заголовок берётся у потока; у встроенного согласия он английский — имя сервиса из него, заголовок свой. */
const title = computed(() => {
  const c = current.value;
  if (c?.component === FlowStage.Consent && (c.permissions?.length ?? 0) > 0) {
    const app = c.flow_info?.title?.replace(/^Redirecting to\s+/i, '').replace(/\s+запрашивает доступ$/i, '').trim();
    return `${app || 'Сервис'} запрашивает доступ`;
  }
  return c?.flow_info?.title ?? 'Вход';
});

/**
 * Подзаголовок карточки: чей это вход и почему он не похож на обычный вход стола.
 *
 * Сюда человека приводит карта кооператора: сеть карт просит кооператив опознать своего
 * пайщика, и экран собирается из шагов CoopID, а не из формы стола. Без пояснения он
 * читался как бедная копия обычного входа (формулировка владельца 03.09.2026). На согласии
 * подзаголовка нет: там заголовок сам называет сервис, который просит доступ.
 */
const subtitle = computed(() => {
  if (current.value?.component === FlowStage.Consent) return '';
  const coop = system.cooperativeDisplayName;
  return coop ? `Вход по карте кооператора · ${coop}` : 'Вход по карте кооператора';
});

const KNOWN = new Set<string>(Object.values(FlowStage));
const unknownStage = computed(() => stage.value !== null && !KNOWN.has(stage.value));

const begin = (): void => {
  runner.value = createFlowRunner(BASE, slug.value, query.value);
  void runner.value.start();
};

/** Живая сессия authentik выясняется при отказе: для вошедшего отказ — «вы уже внутри». */
const entered = ref(false);
watch(stage, async (now) => {
  if (now === FlowStage.Denied || now === FlowStage.Failed) entered.value = await hasIdpSession(BASE);
});

const leave = (): void => {
  void router.push(entered.value ? '/' : { name: 'signin' });
};

/** Переход в соседний поток: адрес приходит от authentik видом `/if/flow/<имя>/`. */
const openFlow = (url: string): void => {
  const found = /\/if\/flow\/([^/?#]+)/.exec(url);
  if (!found) {
    window.location.assign(url);
    return;
  }
  void router.push({ name: 'coopid-flow', params: { slug: found[1] }, query: next.value ? { next: next.value } : {} });
};

onMounted(begin);
watch(slug, begin);
</script>

<style lang="scss">
.coopid-flow-page {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--p-6, 24px);
  min-height: 100vh;
}

/* Общие элементы экранов стадий — одним местом, чтобы стадии не расходились. */
.flow-stage__lead {
  margin: 0 0 var(--p-4);
  color: var(--p-ink-2);
}

.flow-stage__actions {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  margin-top: var(--p-4);

  .base-btn {
    width: 100%;
  }
}

.flow-stage__stack {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);

  .base-btn {
    width: 100%;
  }
}

.flow-stage__links {
  display: flex;
  justify-content: center;
  gap: var(--p-2);
  margin-top: var(--p-3);
}

.flow-stage__divider {
  margin: var(--p-4) 0;
  text-align: center;
  color: var(--p-ink-3);
  font-size: var(--p-fs-sm, 13px);
}
</style>
