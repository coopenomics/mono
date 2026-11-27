<template lang="pug">
//- Зоны строки: опознание (пакет, дата регистрации) → состояние (шаг пути к
//- каталогу и что он значит) → деньги (цена в месяц, под ней пробный срок) →
//- действие (следующий шаг издателя). Строка открывает панель пакета: цена,
//- ключи выпуска и команды терминала.
q-page(padding)
  .q-pa-md
    PageHint.q-mb-md(storage-key='developer:my-packages:hint-dismissed')
      | {{ $t('developer.myPackages.intro') }}

    BaseBanner.q-mb-md(v-if='error', variant='neg') {{ error }}

    EmptyState(
      v-else-if='!firstLoad && !packages.length',
      :title="$t('developer.myPackages.emptyTitle')",
      :body="$t('developer.myPackages.emptyBody')"
    )
      template(#icon)
        q-icon(name='inventory_2', size='28px')

    BaseTable(
      v-else,
      :columns='columns',
      :rows='packages',
      row-key='packageId',
      :loading='firstLoad',
      :skeleton-rows='3',
      min-width='680px',
      clickable-rows,
      @row-click='openPackage'
    )
      template(#cell-package='{ row }')
        .t-mono {{ row.packageId }}
        .t-sm.t-muted {{ $t('developer.myPackages.registeredAt', { date: formatDate(row.registeredAt) }) }}
      template(#cell-stage='{ row }')
        BaseBadge(:variant='STAGES[row.stage].variant') {{ STAGES[row.stage].label }}
        .t-sm.t-muted.q-mt-xs {{ stageNote(row) }}
      template(#cell-price='{ row }')
        template(v-if='hasPrice(row)')
          .my-packages__amount {{ priceLabel(row) }}
          .t-sm.t-muted {{ trialLabel(row) }}
        span.t-muted(v-else) —
      template(#cell-actions='{ row }')
        BaseButton(variant='secondary', size='sm', @click.stop='runNextStep(row)') {{ nextStepLabel(row) }}

  DetailsDrawer(v-model='drawerOpen', :title="current ? current.packageId : ''", :width='520')
    template(v-if='current')
      .my-packages__section
        BaseBadge(:variant='STAGES[current.stage].variant') {{ STAGES[current.stage].label }}
        .t-sm.t-muted.q-mt-xs {{ stageNote(current) }}

      .my-packages__section
        .my-packages__section-head
          .my-packages__section-title {{ $t('developer.myPackages.priceTitle') }}
          BaseButton(variant='secondary', size='sm', :disabled='!current.pricing', @click='openPrice(current)')
            | {{ hasPrice(current) ? $t('developer.price.change') : $t('developer.price.set') }}
        template(v-if='hasPrice(current)')
          DataRow(align='spread', :label="$t('developer.price.priceLabel')", :value='priceLabel(current)')
          DataRow(align='spread', :label="$t('developer.price.trialTitle')", :value='trialValue(current)')
        .t-sm.t-muted(v-else) {{ current.pricing ? $t('developer.myPackages.priceRequired') : $t('developer.myPackages.priceAfterRelease') }}

      .my-packages__section
        .my-packages__section-head
          .my-packages__section-title {{ $t('developer.keys.title') }}
          BaseButton(variant='secondary', size='sm', @click='openIssue(current)') {{ $t('developer.keys.issue') }}
        .t-sm.t-muted(v-if='!current.tokens.length') {{ $t('developer.keys.empty') }}
        .my-packages__key(v-for='token in current.tokens', :key='token.id')
          .my-packages__key-main
            div {{ token.label }}
            .t-sm.t-muted
              span.t-mono {{ token.tokenPrefix }}…
              |
              | · {{ formatDate(token.createdAt) }}
          BaseBadge(:variant='tokenState(token).variant') {{ tokenState(token).label }}
          BaseButton(v-if='isLiveToken(token)', variant='secondary', size='sm', :loading='isSubmitting', @click='revokeKey(token)')
            | {{ $t('developer.keys.revoke') }}

      .my-packages__section
        .my-packages__section-title {{ $t('developer.myPackages.terminalTitle') }}
        .t-sm.t-muted.q-mb-sm {{ $t('developer.myPackages.terminalText') }}
        template(v-if="current.stage === 'registered'")
          .t-sm.q-mb-xs {{ $t('developer.myPackages.createStep') }}
          CommandBlock.q-mb-sm(:command='createCommand(current)')
        .t-sm.q-mb-xs {{ $t('developer.myPackages.publishStep') }}
        CommandBlock.q-mb-sm(:command='publishCommand(current)')
        BaseButton(variant='secondary', size='sm', @click='openGuide') {{ $t('developer.myPackages.openGuide') }}

  BaseDialog(v-model='registerDialog', :title="$t('developer.register.title')", size='sm')
    p.t-sm.t-muted.q-mb-sm {{ $t('developer.register.text') }}
    BaseInput(
      v-model='registerName',
      :label="$t('developer.register.nameLabel')",
      :prefix='packagePrefix',
      :hint="$t('developer.register.nameHint')",
      :error='registerError',
      mono,
      autofocus,
      required
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='registerDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='isSubmitting', @click='confirmRegister') {{ $t('developer.register.submit') }}

  BaseDialog(v-model='priceDialog', :title="$t('developer.price.dialogTitle')", size='sm')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('developer.price.text') }}
    AmountInput(
      v-model='priceForm.rubPerMonth',
      symbol='₽',
      :precision='2',
      :label="$t('developer.price.priceLabel')",
      :hint="$t('developer.price.priceHint')",
      :error='priceErrors.rubPerMonth'
    )
    BaseInput.q-mt-sm(
      v-model='priceForm.trialDays',
      type='number',
      :label="$t('developer.price.trialLabel')",
      :hint="$t('developer.price.trialHint')",
      :error='priceErrors.trialDays'
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='priceDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='isSubmitting', @click='confirmPrice') {{ $t('developer.price.save') }}

  BaseDialog(v-model='issueDialog', :title="$t('developer.keys.issue')", size='sm')
    template(v-if='!issuedToken')
      p.t-sm.t-muted.q-mb-sm {{ $t('developer.keys.issueText') }}
      BaseInput(
        v-model='issueForm.label',
        :label="$t('developer.keys.labelLabel')",
        :hint="$t('developer.keys.labelHint')",
        :error='issueErrors.label',
        required
      )
      BaseInput.q-mt-sm(
        v-model='issueForm.expiresInDays',
        type='number',
        :label="$t('developer.keys.expiresLabel')",
        :hint="$t('developer.keys.expiresHint')",
        :error='issueErrors.expiresInDays'
      )
      BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(v-else)
      BaseBanner.q-mb-sm(variant='warn') {{ $t('developer.keys.copyWarning') }}
      CommandBlock.q-mb-md(:command='issuedToken')
      .t-sm.q-mb-xs {{ $t('developer.keys.nextStep') }}
      CommandBlock(:command='issuePublishCommand')
    template(#footer)
      template(v-if='!issuedToken')
        BaseButton(variant='ghost', :disabled='isSubmitting', @click='issueDialog = false') {{ $t('common.action.cancel') }}
        BaseButton(variant='primary', :loading='isSubmitting', @click='confirmIssue') {{ $t('developer.keys.issueSubmit') }}
      BaseButton(v-else, variant='primary', @click='issueDialog = false') {{ $t('developer.keys.done') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BaseBadge, BaseBanner, BaseButton, BaseDialog, BaseInput, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable/BaseTable.types';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { AmountInput, DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { useHeaderActions } from 'src/shared/hooks';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { isLiveToken, useMyPackages, type IMyPackage, type IMyToken, type PackageStage } from '../features/MyPackages/model';
import { formatDate, formatRub } from '../shared/lib/format';
import CommandBlock from '../shared/ui/CommandBlock.vue';
import HeaderActionButton from '../shared/ui/HeaderActionButton.vue';
import { t } from '../i18n';

/**
 * «Мои пакеты»: пайщик регистрирует пакет на себя, выпускает ключ каталога,
 * назначает цену и видит, на каком шаге пути к каталогу стоит каждый пакет.
 * Выпуск версии идёт из терминала набором издателя: страница даёт готовые
 * команды, формы выпуска в интерфейсе нет.
 */

/** Имя приложения: то же правило, что у команды create-app набора издателя. */
const APP_NAME_RE = /^[a-z][a-z1-5]{1,11}$/;
/** Верхняя граница цены, ₽ в месяц: та же, что у каталога приложений. */
const PRICE_MAX_RUB = 1_000_000;
/** Верхняя граница пробного срока, дней. */
const TRIAL_MAX_DAYS = 365;
/** Верхняя граница срока ключа, дней. */
const KEY_MAX_DAYS = 3650;

const router = useRouter();
const session = useSessionStore();
const systemStore = useSystemStore();
const { confirm } = useConfirm();
const { registerAction } = useHeaderActions();
const { packages, loading, error, isSubmitting, actionError, issuedToken, load, register, setPrice, issue, revoke } =
  useMyPackages();
const firstLoad = useFirstLoad(loading);

const packagePrefix = computed(() => `@${systemStore.info.coopname}/`);

const columns: BaseTableColumn<IMyPackage>[] = [
  { key: 'package', label: t('developer.column.package') },
  { key: 'stage', label: t('developer.column.stage'), width: '260px' },
  { key: 'price', label: t('developer.column.price'), width: '170px' },
  { key: 'actions', label: t('developer.column.actions'), width: '180px', align: 'right', nowrap: true },
];

const STAGES: Record<PackageStage, { label: string; variant: BaseBadgeVariant; note: string }> = {
  registered: { label: t('developer.stage.registered'), variant: 'neutral', note: t('developer.stage.registeredNote') },
  needsPrice: { label: t('developer.stage.needsPrice'), variant: 'warn', note: t('developer.stage.needsPriceNote') },
  moderation: { label: t('developer.stage.moderation'), variant: 'info', note: t('developer.stage.moderationNote') },
  active: { label: t('developer.stage.active'), variant: 'pos', note: '' },
};

function stageNote(pkg: IMyPackage): string {
  if (pkg.stage !== 'active') return STAGES[pkg.stage].note;
  return t('developer.stage.activeNote', { version: pkg.pricing?.lastActiveVersion ?? '' });
}

function hasPrice(pkg: IMyPackage): boolean {
  return pkg.pricing?.rubPerMonth != null;
}

function priceLabel(pkg: IMyPackage): string {
  const rub = pkg.pricing?.rubPerMonth ?? 0;
  return rub === 0 ? t('developer.price.free') : t('developer.perMonth', { amount: formatRub(rub) });
}

function trialLabel(pkg: IMyPackage): string {
  const days = pkg.pricing?.trialDays ?? 0;
  return days > 0 ? t('developer.price.trialDays', { days }) : t('developer.price.noTrial');
}

/** Пробный срок значением строки «подпись — значение»: без повтора подписи. */
function trialValue(pkg: IMyPackage): string {
  const days = pkg.pricing?.trialDays ?? 0;
  return days > 0 ? t('developer.price.days', { days }) : t('developer.price.none');
}

function tokenState(token: IMyToken): { label: string; variant: BaseBadgeVariant } {
  if (token.revokedAt) return { label: t('developer.keys.state.revoked'), variant: 'neutral' };
  if (!isLiveToken(token)) return { label: t('developer.keys.state.expired'), variant: 'warn' };
  return { label: t('developer.keys.state.active'), variant: 'pos' };
}

const createCommand = (pkg: IMyPackage) => `./create-app ${pkg.name} "${t('developer.myPackages.appTitleSample')}"`;
const publishCommand = (pkg: IMyPackage) => `./publish-app ${pkg.name}`;

// ── Панель пакета ──────────────────────────────────────────────────────────
const drawerOpen = ref(false);
/** Пакет в панели — по идентификатору: после действия панель показывает свежее. */
const currentId = ref<string | null>(null);
const current = computed(() => packages.value.find((p) => p.packageId === currentId.value) ?? null);

function openPackage(pkg: IMyPackage) {
  currentId.value = pkg.packageId;
  drawerOpen.value = true;
}

function openGuide() {
  drawerOpen.value = false;
  void router.push({ name: 'developer-release-guide' });
}

/** Следующий шаг издателя по пакету: ключ → цена; дальше — правка цены. */
function nextStepLabel(pkg: IMyPackage): string {
  if (pkg.stage === 'registered') return pkg.tokens.some(isLiveToken) ? t('developer.myPackages.howToRelease') : t('developer.keys.issue');
  return hasPrice(pkg) ? t('developer.price.change') : t('developer.price.set');
}

function runNextStep(pkg: IMyPackage) {
  if (pkg.stage !== 'registered') return openPrice(pkg);
  if (pkg.tokens.some(isLiveToken)) return openPackage(pkg);
  return openIssue(pkg);
}

// ── Регистрация пакета ─────────────────────────────────────────────────────
const registerDialog = ref(false);
const registerName = ref('');
const registerError = ref('');

function openRegister() {
  registerName.value = '';
  registerError.value = '';
  actionError.value = null;
  registerDialog.value = true;
}

async function confirmRegister() {
  const name = registerName.value.trim();
  registerError.value = APP_NAME_RE.test(name) ? '' : t('developer.register.nameFormat');
  if (registerError.value) return;
  const packageId = `${packagePrefix.value}${name}`;
  if (!(await register(session.username, packageId))) return;
  registerDialog.value = false;
  currentId.value = packageId;
  drawerOpen.value = true;
}

// ── Цена ───────────────────────────────────────────────────────────────────
const priceDialog = ref(false);
const pricePackageId = ref('');
const priceForm = reactive<{ rubPerMonth: number | string | null; trialDays: number | string | null }>({
  rubPerMonth: null,
  trialDays: 0,
});
const priceErrors = reactive({ rubPerMonth: '', trialDays: '' });

function openPrice(pkg: IMyPackage) {
  pricePackageId.value = pkg.packageId;
  priceForm.rubPerMonth = pkg.pricing?.rubPerMonth ?? null;
  priceForm.trialDays = pkg.pricing?.trialDays ?? 0;
  priceErrors.rubPerMonth = '';
  priceErrors.trialDays = '';
  actionError.value = null;
  priceDialog.value = true;
}

/** Цена из поля формы: рубли с копейками либо `null`, когда значение вне допустимого. */
function parsePrice(value: number | string | null): number | null {
  if (value === null || value === '') return null;
  const rub = Number(value);
  const kopecks = Math.round(rub * 100);
  const valid = Number.isFinite(rub) && rub >= 0 && rub <= PRICE_MAX_RUB && Math.abs(kopecks - rub * 100) < 1e-6;
  return valid ? kopecks / 100 : null;
}

/** Целое число дней из поля формы в границах либо `null`; пустое поле — `empty`. */
function parseDays(value: number | string | null, empty: number | null, min: number, max: number): number | null {
  if (value === null || value === '') return empty;
  const days = Number(value);
  return Number.isInteger(days) && days >= min && days <= max ? days : null;
}

async function confirmPrice() {
  const rubPerMonth = parsePrice(priceForm.rubPerMonth);
  const trialDays = parseDays(priceForm.trialDays, 0, 0, TRIAL_MAX_DAYS);
  priceErrors.rubPerMonth = rubPerMonth === null ? t('developer.price.priceRange') : '';
  priceErrors.trialDays = trialDays === null ? t('developer.price.trialRange') : '';
  if (rubPerMonth === null || trialDays === null) return;
  if (await setPrice({ packageId: pricePackageId.value, rubPerMonth, trialDays })) priceDialog.value = false;
}

// ── Ключи выпуска ──────────────────────────────────────────────────────────
const issueDialog = ref(false);
const issuePackage = ref<IMyPackage | null>(null);
const issueForm = reactive<{ label: string; expiresInDays: number | string | null }>({ label: '', expiresInDays: null });
const issueErrors = reactive({ label: '', expiresInDays: '' });
const issuePublishCommand = computed(() => (issuePackage.value ? publishCommand(issuePackage.value) : ''));

function openIssue(pkg: IMyPackage) {
  issuePackage.value = pkg;
  issueForm.label = t('developer.keys.labelDefault');
  issueForm.expiresInDays = null;
  issueErrors.label = '';
  issueErrors.expiresInDays = '';
  actionError.value = null;
  issuedToken.value = null;
  issueDialog.value = true;
}

async function confirmIssue() {
  if (!issuePackage.value) return;
  const label = issueForm.label.trim();
  // Пустое поле срока — ключ без срока: признак «пусто» отличается от ошибки нулём.
  const days = parseDays(issueForm.expiresInDays, 0, 1, KEY_MAX_DAYS);
  issueErrors.label = label ? '' : t('developer.keys.labelRequired');
  issueErrors.expiresInDays = days === null ? t('developer.keys.expiresRange') : '';
  if (!label || days === null) return;
  await issue({ packageId: issuePackage.value.packageId, label, ...(days > 0 ? { expiresInDays: days } : {}) });
}

async function revokeKey(token: IMyToken) {
  const agreed = await confirm({
    title: t('developer.keys.revokeTitle'),
    message: t('developer.keys.revokeText', { label: token.label }),
    confirmLabel: t('developer.keys.revoke'),
    danger: true,
  });
  if (agreed) await revoke(token.id);
}

// realtime: нет источника — пакеты, цены и ключи хранит внешний каталог приложений, лента цепи кооператива о них не сообщает; список перечитывается после каждого действия на странице.
onMounted(async () => {
  registerAction({
    id: 'developer:register-package',
    component: HeaderActionButton,
    props: { label: t('developer.register.action'), icon: 'add', onClick: openRegister },
  });
  await load();
});
</script>

<style scoped>
.my-packages__amount {
  font-weight: 600;
}
.my-packages__section {
  padding: var(--p-4) 0;
  border-top: 1px solid var(--p-line);
}
.my-packages__section:first-child {
  padding-top: 0;
  border-top: 0;
}
.my-packages__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  margin-bottom: var(--p-2);
}
.my-packages__section-title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  margin-bottom: var(--p-2);
}
.my-packages__section-head .my-packages__section-title {
  margin-bottom: 0;
}
.my-packages__key {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-2) 0;
}
.my-packages__key-main {
  flex: 1;
  min-width: 0;
}
</style>
