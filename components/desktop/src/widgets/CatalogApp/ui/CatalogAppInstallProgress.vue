<template lang="pug">
//- Ход установки приложения из каталога после подписки. Установка идёт на
//- узле (оркестратор получает фронт пакета), поэтому председатель видит
//- шаги, а не «вернитесь позже»: подписка оформлена → согласие на права ядра
//- → приложение получено узлом → стол добавлен в меню. Шаг согласия есть
//- только у приложения, которое просит права. Пока шаг не закрыт, страница
//- опрашивает узел.
BaseCard(:title="$t('catalogApp.progress.title')")
  q-linear-progress.catalog-app-progress__bar(
    v-if='!done',
    indeterminate,
    color='primary',
    size='3px'
  )
  VerticalStepper(:steps='steps', :active-key='activeKey', :completed='completedKeys')
    //- Шаг согласия: приложение просит права ядра, без ответа председателя узел его не ставит.
    template(#active='{ step }')
      .catalog-app-progress__consent(v-if="step.key === 'rights'")
        CoreRightsList(:ports='needed.ports', :chain-actions='needed.chainActions')
        BaseButton.full-width(variant='primary', type='button', :loading='allowing', :disabled='!canManage', @click='allow')
          | {{ $t('catalogApp.rights.allowInstall') }}
        p.catalog-app-progress__note(v-if='!canManage') {{ $t('catalogApp.rights.chairmanOnly') }}
  p.catalog-app-progress__note(v-if='!done') {{ $t('catalogApp.progress.note') }}
  template(v-if='done', #footer)
    BaseButton(variant='primary', type='button', @click='openDesk') {{ $t('catalogApp.progress.openDesk') }}
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { BaseButton, BaseCard } from 'src/shared/ui/base';
import { VerticalStepper, type StepperStep } from 'src/shared/ui/domain';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { type CatalogApp, awaitsConsent, isLiveSubscription, neededRights, useCatalogAppStore } from 'src/entities/CatalogApp';
import { FailAlert } from 'src/shared/api/alerts';
import { runRemotePass } from 'src/processes/init-installed-extensions/remote-pass';
import { t } from 'src/shared/i18n';
import CoreRightsList from './CoreRightsList.vue';

const props = defineProps<{ app: CatalogApp }>();
const emit = defineEmits<{ done: [] }>();

const router = useRouter();
const desktop = useDesktopStore();
const catalog = useCatalogAppStore();

const SUBSCRIBED: StepperStep = { key: 'subscribed', label: t('catalogApp.progress.subscribed'), description: t('catalogApp.progress.subscribedHint') };
const RIGHTS: StepperStep = { key: 'rights', label: t('catalogApp.progress.rights'), description: t('catalogApp.progress.rightsHint') };
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

// Права ядра: что приложение просит и на что председатель ещё не ответил.
const rights = computed(() => catalog.rightsOf(props.app.packageId));
const needed = computed(() => neededRights(rights.value));
/** Приложение просит права ядра либо уже получило их: шаг согласия показывается. */
const asksRights = computed(() => {
  const r = rights.value;
  if (!r) return false;
  const asked = r.requested ?? r.granted;
  return asked.ports.length + asked.chainActions.length > 0 || awaitsConsent(r);
});
const consentGiven = computed(() => subscribed.value && asksRights.value && !awaitsConsent(rights.value));
const steps = computed<StepperStep[]>(() => (asksRights.value ? [SUBSCRIBED, RIGHTS, FRONTEND, DESK] : [SUBSCRIBED, FRONTEND, DESK]));
// Согласие — по праву `Apps:manage`; совет видит шаг, но кнопка закрыта.
const canManage = computed(() => desktop.hasGrant('apps', 'Apps:manage'));

const completedKeys = computed(() => {
  const keys: string[] = [];
  if (subscribed.value) keys.push('subscribed');
  if (consentGiven.value) keys.push('rights');
  if (frontendReady.value) keys.push('frontend');
  if (deskReady.value) keys.push('desk');
  return keys;
});
const activeKey = computed(() => {
  if (!subscribed.value) return 'subscribed';
  if (asksRights.value && !consentGiven.value) return 'rights';
  return frontendReady.value ? 'desk' : 'frontend';
});
const done = computed(() => deskReady.value);

const allowing = ref(false);
/** Председатель согласился с правами: ядро выдаёт ключ, узел ставит приложение ближайшим опросом. */
async function allow(): Promise<void> {
  allowing.value = true;
  try {
    await catalog.grantRights(props.app.packageId, needed.value);
  } catch (e) {
    FailAlert(e);
  } finally {
    allowing.value = false;
  }
}

// Узел ставит приложение сам, лента цепи кооператива об этом не сообщает:
// пока установка идёт, витрина перечитывается и стол подхватывается опросом.
// timing: schedule — фронт пакета ставит оркестратор кооператива, лента цепи кооператива об установке не сообщает
const POLL_MS = 3_000;
let timer: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  if (done.value) return;
  await catalog.load();
  // Права перечитываются, пока приложение не получено узлом: перечень версии
  // каталог отдаёт после оформления подписки, не мгновенно.
  if (subscribed.value && !frontendReady.value) await catalog.loadRights(props.app.packageId).catch(() => undefined);
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
.catalog-app-progress__consent {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.catalog-app-progress__note {
  margin: var(--p-4, 16px) 0 0;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
}
</style>
