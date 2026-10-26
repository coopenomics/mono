<template lang="pug">
//- Ход установки приложения из каталога после подписки. Установка идёт на
//- узле (оркестратор получает фронт пакета), поэтому председатель видит
//- шаги, а не «вернитесь позже»: подписка оформлена → приложение получено
//- узлом → стол добавлен в меню. Пока шаг не закрыт, страница опрашивает узел.
BaseCard(:title="$t('catalogApp.progress.title')")
  q-linear-progress.catalog-app-progress__bar(
    v-if='!done',
    indeterminate,
    color='primary',
    size='3px'
  )
  VerticalStepper(:steps='steps', :active-key='activeKey', :completed='completedKeys')
  p.catalog-app-progress__note(v-if='!done') {{ $t('catalogApp.progress.note') }}
  template(v-if='done', #footer)
    BaseButton(variant='primary', type='button', @click='openDesk') {{ $t('catalogApp.progress.openDesk') }}
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { BaseButton, BaseCard } from 'src/shared/ui/base';
import { VerticalStepper, type StepperStep } from 'src/shared/ui/domain';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { type CatalogApp, isLiveSubscription, useCatalogAppStore } from 'src/entities/CatalogApp';
import { runRemotePass } from 'src/processes/init-installed-extensions/remote-pass';
import { t } from 'src/shared/i18n';

const props = defineProps<{ app: CatalogApp }>();
const emit = defineEmits<{ done: [] }>();

const router = useRouter();
const desktop = useDesktopStore();
const catalog = useCatalogAppStore();

const steps: StepperStep[] = [
  { key: 'subscribed', label: t('catalogApp.progress.subscribed'), description: t('catalogApp.progress.subscribedHint') },
  { key: 'frontend', label: t('catalogApp.progress.frontend'), description: t('catalogApp.progress.frontendHint') },
  { key: 'desk', label: t('catalogApp.progress.desk'), description: t('catalogApp.progress.deskHint') },
];

const subscribed = computed(() => isLiveSubscription(props.app.subscription));
const frontendReady = computed(() => subscribed.value && props.app.installed);
/** Стол пакета зарегистрирован на рабочем столе — его видно в меню. */
const deskReady = computed(() =>
  frontendReady.value &&
  props.app.enabled &&
  (desktop.currentDesktop?.workspaces ?? []).some((w) => (w as { extension_name?: string }).extension_name === props.app.packageId),
);

const completedKeys = computed(() => {
  const keys: string[] = [];
  if (subscribed.value) keys.push('subscribed');
  if (frontendReady.value) keys.push('frontend');
  if (deskReady.value) keys.push('desk');
  return keys;
});
const activeKey = computed(() => (!subscribed.value ? 'subscribed' : !frontendReady.value ? 'frontend' : 'desk'));
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
