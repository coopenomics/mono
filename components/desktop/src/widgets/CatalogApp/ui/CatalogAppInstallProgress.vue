<template lang="pug">
//- Ход установки приложения из каталога после подписки. Установка идёт на
//- узле (оркестратор получает фронт пакета), поэтому председатель видит
//- шаги, а не «вернитесь позже»: подписка оформлена → первый месяц оплачен
//- → приложение получено узлом → стол добавлен в меню. Согласие на права
//- ядра председатель даёт до подписки, на экране подписки (28.11.2026).
//- Подписка без согласия (оплачена позже, каталог не ответил на экране
//- подписки) получает шаг «Согласие на права»: установка стоит на нём, а
//- полоса хода не движется — узел ждёт председателя, а не работает.
//- Шаг оплаты есть только у подписки без пробного срока. Пока шаг не закрыт,
//- страница опрашивает узел.
BaseCard(:title="$t('catalogApp.progress.title')")
  q-linear-progress.catalog-app-progress__bar(
    v-if='!done && !waitsConsent',
    indeterminate,
    color='primary',
    size='3px'
  )
  VerticalStepper(:steps='steps', :active-key='activeKey', :completed='completedKeys')
  p.catalog-app-progress__note(v-if='!done') {{ waitsConsent ? $t('catalogApp.progress.noteConsent') : $t('catalogApp.progress.note') }}
  template(v-if='done', #footer)
    BaseButton(variant='primary', type='button', @click='openDesk') {{ $t('catalogApp.progress.openDesk') }}
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { BaseButton, BaseCard } from 'src/shared/ui/base';
import { VerticalStepper, type StepperStep } from 'src/shared/ui/domain';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { type CatalogApp, awaitsFirstPayment, isLiveSubscription, useCatalogAppStore } from 'src/entities/CatalogApp';
import { runRemotePass } from 'src/processes/init-installed-extensions/remote-pass';
import { t } from 'src/shared/i18n';
import { formatRub } from '../lib/presentation';

const props = defineProps<{ app: CatalogApp }>();
const emit = defineEmits<{ done: [] }>();

const router = useRouter();
const desktop = useDesktopStore();
const catalog = useCatalogAppStore();

const SUBSCRIBED: StepperStep = { key: 'subscribed', label: t('catalogApp.progress.subscribed'), description: t('catalogApp.progress.subscribedHint') };
const FRONTEND: StepperStep = { key: 'frontend', label: t('catalogApp.progress.frontend'), description: t('catalogApp.progress.frontendHint') };
const DESK: StepperStep = { key: 'desk', label: t('catalogApp.progress.desk'), description: t('catalogApp.progress.deskHint') };

const subscribed = computed(() => isLiveSubscription(props.app.subscription));
const frontendReady = computed(() => subscribed.value && props.app.installed);
/** Стол пакета зарегистрирован на рабочем столе — его видно в меню. */
const deskReady = computed(() =>
  frontendReady.value &&
  props.app.enabled &&
  (desktop.currentDesktop?.workspaces ?? []).some((w) => (w as { extension_name?: string }).extension_name === props.app.packageId),
);

// Оплата вперёд: подписка без пробного срока ставится после первого списания
// с кошелька членских взносов у оператора (28.11.2026).
const sub = computed(() => props.app.subscription);
const paysUpfront = computed(() => !!sub.value && !sub.value.isTrial);
const paid = computed(() => subscribed.value && !awaitsFirstPayment(sub.value));
const PAYMENT = computed<StepperStep>(() => ({
  key: 'payment',
  label: t('catalogApp.progress.payment'),
  description: t('catalogApp.progress.paymentHint', { amount: formatRub(sub.value?.amountPerPeriod ?? props.app.rubPerMonth) }),
}));
// Согласие председателя на права ядра: без него ядро не выпускает приложению
// ключ, и узел приложение не устанавливает. Шаг виден, только пока согласия нет.
const CONSENT: StepperStep = { key: 'consent', label: t('catalogApp.progress.consent'), description: t('catalogApp.progress.consentHint') };
const waitsConsent = computed(() => props.app.rightsPending && !frontendReady.value && (!paysUpfront.value || paid.value));
const steps = computed<StepperStep[]>(() => [
  SUBSCRIBED,
  ...(paysUpfront.value ? [PAYMENT.value] : []),
  ...(props.app.rightsPending && !frontendReady.value ? [CONSENT] : []),
  FRONTEND,
  DESK,
]);

const completedKeys = computed(() => {
  const keys: string[] = [];
  if (subscribed.value) keys.push('subscribed');
  if (paysUpfront.value && paid.value) keys.push('payment');
  if (frontendReady.value) keys.push('frontend');
  if (deskReady.value) keys.push('desk');
  return keys;
});
const activeKey = computed(() => {
  if (!subscribed.value) return 'subscribed';
  if (paysUpfront.value && !paid.value) return 'payment';
  if (waitsConsent.value) return 'consent';
  return frontendReady.value ? 'desk' : 'frontend';
});
const done = computed(() => deskReady.value);

// Узел ставит приложение сам, лента цепи кооператива об этом не сообщает:
// пока установка идёт, витрина перечитывается и стол подхватывается опросом.
// timing: schedule — фронт пакета ставит оркестратор кооператива, лента цепи кооператива об установке не сообщает
const POLL_MS = 3_000;
let timer: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  if (done.value) return;
  await catalog.load();
  if (frontendReady.value) await runRemotePass(router);
}

function stop(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

// realtime: нет источника — фронт пакета ставит оркестратор кооператива, лента цепи кооператива об установке не сообщает; страница опрашивает витрину узла.
onMounted(() => {
  void tick();
  // timing: schedule — фронт пакета ставит оркестратор кооператива, лента цепи кооператива об установке не сообщает
  timer = setInterval(() => void tick(), POLL_MS);
});
onBeforeUnmount(stop);

watch(done, (isDone) => {
  if (isDone) {
    stop();
    emit('done');
  }
});

const openDesk = () => {
  const ws = (desktop.currentDesktop?.workspaces ?? []).find(
    (w) => (w as { extension_name?: string }).extension_name === props.app.packageId,
  );
  if (!ws) return;
  desktop.selectWorkspace(ws.name);
  desktop.goToDefaultPage(router);
};
</script>

<style scoped lang="scss">
.catalog-app-progress__bar {
  margin-bottom: var(--p-4, 16px);
  border-radius: var(--p-r-pill, 999px);
}
.catalog-app-progress__note {
  margin: var(--p-4, 16px) 0 0;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
}
</style>
