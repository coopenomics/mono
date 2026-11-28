<template lang="pug">
//- Подписка на приложение каталога — экран шагами вместо страницы приложения
//- (слово владельца 28.11.2026): права ядра → настройки → итог со стоимостью →
//- «Подписаться». Согласие на права даётся до подписки, а не в ходе установки.
//- Настроек у пакетов каталога пока нет — шаг пропускается. Кнопки шага —
//- в липком подвале: «Назад» слева, действие шага справа.
.subscribe-flow
  .subscribe-flow__head
    h2.subscribe-flow__title {{ $t('catalogApp.subscribe.title', { title: app.title }) }}
    ol.subscribe-flow__steps
      li.subscribe-flow__step(
        v-for='(s, i) in steps',
        :key='s.key',
        :class='{ "subscribe-flow__step--active": s.key === stepKey, "subscribe-flow__step--done": i < stepIndex }'
      )
        span.subscribe-flow__num
          q-icon(v-if='i < stepIndex', name='check', size='14px')
          template(v-else) {{ i + 1 }}
        span {{ s.label }}

  //- Каркас до первой загрузки: права и кошелёк читаются с узла.
  .subscribe-flow__body(v-if='firstLoad')
    q-skeleton(type='text', width='60%')
    q-skeleton.q-mt-md(type='rect', height='160px')

  //- Шаг 1. Права ядра, которые просит действующая версия приложения.
  .subscribe-flow__body(v-else-if='stepKey === "rights"')
    p.subscribe-flow__lead {{ $t('catalogApp.subscribe.rightsLead') }}
    BaseBanner(v-if='rightsUnknown', variant='warn') {{ $t('catalogApp.subscribe.rightsUnknown') }}
    CoreRightsList(v-else, :ports='requested.ports', :chain-actions='requested.chainActions')

  //- Шаг 2. Итог: что подключается, сколько стоит и когда списывается.
  .subscribe-flow__body(v-else)
    p.subscribe-flow__lead {{ $t('catalogApp.subscribe.summaryLead') }}
    .subscribe-flow__facts
      DataRow(:label="$t('catalogApp.subscribe.app')", :value='app.title', align='spread')
      DataRow(:label="$t('catalogApp.info.publisher')", :value='app.publisher', align='spread')
      DataRow(:label="$t('catalogApp.subscribe.rights')", :value='rightsSummary', align='spread')
      DataRow(:label="$t('catalogApp.info.price')", :value='price', align='spread')
      DataRow(
        v-if='hasTrial',
        :label="$t('catalogApp.info.trial')",
        :value="$t('catalogApp.subscribe.trialValue', { days: app.trialDays, date: trialEndsOn })",
        align='spread'
      )
      DataRow(
        v-if='paid',
        :label="renewing ? $t('catalogApp.subscribe.renewCharge') : $t('catalogApp.subscribe.firstCharge')",
        :value='firstCharge',
        align='spread'
      )
      //- Оператор списывает счёт кооператива целиком: долг по другим
      //- подпискам стоит в итоге отдельной строкой, иначе сумма к списанию
      //- расходится с ценой приложения без объяснения (28.11.2026).
      DataRow(
        v-if='paid && otherDue > 0',
        :label="$t('catalogApp.subscribe.otherDue')",
        :value="$t('catalogApp.subscribe.rub', { amount: formatRub(otherDue) })",
        align='spread'
      )
      DataRow(
        v-if='paid && otherDue > 0',
        :label="$t('catalogApp.subscribe.totalDue')",
        :value="$t('catalogApp.subscribe.rub', { amount: formatRub(need) })",
        align='spread'
      )
      DataRow(
        v-if='paid && balance !== null',
        :label="$t('catalogApp.subscribe.balance')",
        :value="$t('catalogApp.subscribe.rub', { amount: formatRub(balance) })",
        align='spread'
      )
    p.subscribe-flow__note(v-if='paid') {{ chargeNote }}
    BaseBanner(v-if='shortage', variant='neg')
      | {{ shortageText }}
      template(v-if='operatorCabinet', #action)
        BaseButton(variant='secondary', size='sm', type='button', @click='openOperatorSite') {{ $t('catalogApp.subscribe.topUp') }}
    BaseBanner(v-if='error', variant='neg') {{ error }}
    p.subscribe-flow__note(v-if='!canManage') {{ $t('catalogApp.actions.chairmanOnly') }}

  .subscribe-flow__bar
    BaseButton(variant='ghost', type='button', :disabled='busy', @click='back')
      | {{ stepIndex === 0 ? $t('common.action.cancel') : $t('common.action.back') }}
    BaseButton(
      v-if='stepKey === "rights"',
      variant='primary',
      type='button',
      :disabled='firstLoad || !canManage',
      @click='next'
    ) {{ rightsUnknown ? $t('catalogApp.subscribe.continue') : $t('catalogApp.subscribe.allow') }}
    BaseButton(
      v-else,
      variant='primary',
      type='button',
      :loading='busy',
      :disabled='firstLoad || !canManage || (shortage && !renewing)',
      @click='confirm'
    ) {{ renewing ? $t('catalogApp.actions.resume') : $t('catalogApp.actions.subscribe') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Ledger2Contract } from 'cooptypes';
import { Zeus } from '@coopenomics/sdk';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { useFirstLoad } from 'src/shared/lib/composables';
import { APPS_CATALOG_LIVE, liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { SuccessAlert } from 'src/shared/api/alerts';
import { t } from 'src/shared/i18n';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { api as extensionApi } from 'src/entities/Extension/api';
import { type CatalogApp, type CatalogAppRightsSet, useCatalogAppStore } from 'src/entities/CatalogApp';
import { runRemotePass } from 'src/processes/init-installed-extensions/remote-pass';
import { formatDay, formatRub } from '../lib/presentation';
import { operatorCabinetUrl, rubOfAsset } from '../lib/operatorWallet';
import CoreRightsList from './CoreRightsList.vue';

const props = defineProps<{ app: CatalogApp }>();

const router = useRouter();
const store = useCatalogAppStore();
const desktop = useDesktopStore();
// Подписку оформляет председатель: право `Apps:manage`; совет видит шаги без кнопок.
const canManage = computed(() => desktop.hasGrant('apps', 'Apps:manage'));

type StepKey = 'rights' | 'summary';

const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const error = ref<string | null>(null);

// Права версии: до подписки их отдаёт каталог через узел. `null` — каталог не ответил.
const requested = ref<CatalogAppRightsSet>({ ports: [], chainActions: [] });
const rightsUnknown = ref(false);
const asksRights = computed(() => rightsUnknown.value || requested.value.ports.length + requested.value.chainActions.length > 0);

// Кошелёк членских взносов у оператора: остаток и позиции счёта, ждущие списания.
const balance = ref<number | null>(null);
const dueAmount = ref(0);
const operatorSite = ref<string | null>(null);
const operator = ref<string | null>(null);
/** Кабинет кооператива у оператора: пополнение кошелька проводится там. */
const operatorCabinet = computed(() => operatorCabinetUrl(operatorSite.value, operator.value));

const steps = computed(() => [
  ...(asksRights.value ? [{ key: 'rights' as StepKey, label: t('catalogApp.subscribe.stepRights') }] : []),
  { key: 'summary' as StepKey, label: t('catalogApp.subscribe.stepSummary') },
]);
const stepIndex = ref(0);
const stepKey = computed<StepKey>(() => steps.value[Math.min(stepIndex.value, steps.value.length - 1)]?.key ?? 'summary');

const price = computed(() =>
  props.app.rubPerMonth > 0
    ? t('catalogApp.price.perMonth', { amount: formatRub(props.app.rubPerMonth) })
    : t('catalogApp.price.free'),
);
const hasTrial = computed(() => props.app.trialDays > 0);
/** Подписка платная: без пробного срока первый месяц списывается сразу. */
const paid = computed(() => props.app.rubPerMonth > 0);
const trialEndsOn = computed(() => {
  const end = new Date();
  end.setDate(end.getDate() + props.app.trialDays);
  return formatDay(end.toISOString());
});
/**
 * Подписка на приложение у провайдера уже есть и не оплачена в срок: экран
 * открыт со страницы «Не оплачено». Новая подписка не оформляется — месяц
 * приложения уже стоит в счёте оператора, председатель подтверждает права.
 */
const renewing = computed(() => !!props.app.subscription);
/** Месяц приложения: у прежней подписки — её сумма в счёте, у новой — цена каталога. */
const ownPrice = computed(() =>
  renewing.value ? (props.app.subscription?.amountPerPeriod ?? props.app.rubPerMonth) : props.app.rubPerMonth,
);
const firstCharge = computed(() => {
  if (renewing.value) return t('catalogApp.subscribe.rub', { amount: formatRub(ownPrice.value) });
  return hasTrial.value
    ? t('catalogApp.subscribe.chargeOn', { date: trialEndsOn.value, amount: formatRub(props.app.rubPerMonth) })
    : t('catalogApp.subscribe.chargeNow', { amount: formatRub(props.app.rubPerMonth) });
});
const chargeNote = computed(() => {
  if (renewing.value) return t('catalogApp.subscribe.noteRenew');
  return hasTrial.value ? t('catalogApp.subscribe.noteTrial') : t('catalogApp.subscribe.notePaid');
});
const rightsSummary = computed(() => {
  if (rightsUnknown.value) return t('catalogApp.subscribe.rightsLater');
  const count = requested.value.ports.length + requested.value.chainActions.length;
  return count > 0 ? t('catalogApp.subscribe.rightsGiven', { count }) : t('catalogApp.subscribe.rightsNone');
});

/**
 * Долг кооператива по другим подпискам. Счёт оператора уже содержит месяц
 * прежней подписки на это приложение — он вычитается, иначе цена приложения
 * считается дважды (28.11.2026: 3 700 ₽ вместо 3 600 ₽).
 */
const otherDue = computed(() =>
  Math.max(0, Math.round((dueAmount.value - (renewing.value ? ownPrice.value : 0)) * 100) / 100),
);
/** Сумма, которую хаб оператора списывает сразу: месяц приложения и долг по другим подпискам. */
const need = computed(() => Math.round((ownPrice.value + otherDue.value) * 100) / 100);
const shortageText = computed(() => {
  const available = formatRub(balance.value ?? 0);
  const base =
    otherDue.value > 0
      ? t('catalogApp.subscribe.shortageWithDebt', {
          available,
          need: formatRub(need.value),
          price: formatRub(ownPrice.value),
          debt: formatRub(otherDue.value),
        })
      : t('catalogApp.subscribe.shortage', { need: formatRub(need.value), available });
  return renewing.value ? `${base} ${t('catalogApp.subscribe.shortageRenew')}` : base;
});
// Правило держит и узел: без остатка подписка без пробного срока не оформляется.
const shortage = computed(() => paid.value && !hasTrial.value && balance.value !== null && balance.value + 1e-9 < need.value);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [rights, billing] = await Promise.all([
      extensionApi.loadCatalogAppRights(props.app.packageId).catch(() => null),
      extensionApi.loadAppsNodeBilling().catch(() => null),
    ]);
    rightsUnknown.value = !rights?.requested;
    requested.value = {
      ports: rights?.requested?.ports ?? [],
      chainActions: rights?.requested?.chainActions ?? [],
    };
    balance.value = rubOfAsset(billing?.wallet?.membershipAvailable);
    dueAmount.value = billing?.dueAmount ?? 0;
    operatorSite.value = billing?.operatorSite ?? null;
    operator.value = billing?.operator ?? null;
  } finally {
    loading.value = false;
  }
}

function toApp(): void {
  void router.push({ name: 'one-extension', params: { name: props.app.packageId } });
}

function back(): void {
  error.value = null;
  if (stepIndex.value === 0) toApp();
  else stepIndex.value -= 1;
}

function next(): void {
  stepIndex.value = Math.min(stepIndex.value + 1, steps.value.length - 1);
}

function openOperatorSite(): void {
  if (operatorCabinet.value) window.open(operatorCabinet.value, '_blank', 'noopener');
}

/**
 * «Подписаться»: согласие на права записывается первым — узел ставит
 * приложение без вопроса председателю; затем провайдер оформляет подписку.
 * Отказ подписки оставляет согласие: при повторной подписке оно то же.
 */
async function confirm(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    if (!rightsUnknown.value && asksRights.value) {
      await store.grantRights(props.app.packageId, requested.value);
    }
    const result = await store.subscribe(props.app.packageId);
    if (result.status === Zeus.SubscribePackageStatus.ACTIVATED || result.status === Zeus.SubscribePackageStatus.ALREADY_ACTIVE) {
      SuccessAlert(doneText(result));
      void runRemotePass(router);
      toApp();
      return;
    }
    error.value = result.error || t('catalogApp.subscribe.failed');
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

/** Итог для председателя: прежняя подписка ждёт пополнения кошелька либо списания. */
function doneText(result: { state?: Zeus.SubscriptionStateEnum | null; endAt?: string | null }): string {
  if (renewing.value) return shortage.value ? t('catalogApp.subscribe.doneRenewWait') : t('catalogApp.subscribe.doneRenew');
  return hasTrial.value && result.state === Zeus.SubscriptionStateEnum.TRIAL
    ? t('catalogApp.subscribe.doneTrial', { date: formatDay(result.endAt) })
    : t('catalogApp.subscribe.donePaid');
}

// Живое обновление: остаток кошелька членских взносов (пополнение на сайте
// оператора) и согласие на права, данное с другого стола.
useLiveReload([liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets), APPS_CATALOG_LIVE.rightsConsents], load);
onMounted(load);
</script>

<style scoped>
.subscribe-flow {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  max-width: 720px;
}
.subscribe-flow__title {
  margin: 0;
  font-size: var(--p-fs-h1);
  font-weight: 700;
  letter-spacing: var(--p-ls-h1);
  color: var(--p-ink);
}
.subscribe-flow__steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-4);
  margin: var(--p-3) 0 0;
  padding: 0;
  list-style: none;
}
.subscribe-flow__step {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
.subscribe-flow__step--active {
  color: var(--p-ink);
  font-weight: 600;
}
.subscribe-flow__step--done {
  color: var(--p-ink-2);
}
.subscribe-flow__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--p-6);
  height: var(--p-6);
  border-radius: var(--p-r-pill);
  background: var(--p-surface-2);
  color: var(--p-ink-2);
  font-variant-numeric: tabular-nums;
}
.subscribe-flow__step--active .subscribe-flow__num,
.subscribe-flow__step--done .subscribe-flow__num {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}
.subscribe-flow__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-height: 240px;
}
.subscribe-flow__lead {
  margin: 0;
  color: var(--p-ink-2);
}
.subscribe-flow__note {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
/* Подвал шага прилипает к низу экрана: кнопки видны без прокрутки. */
.subscribe-flow__bar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  background: var(--p-surface);
  border-top: 1px solid var(--p-line);
}
@media (max-width: 600px) {
  .subscribe-flow__bar {
    flex-direction: column-reverse;
  }
}
</style>
