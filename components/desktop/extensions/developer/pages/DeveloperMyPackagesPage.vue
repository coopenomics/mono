<template lang="pug">
//- Каркас страницы списка по образцу «Мои заказы»: действие в шапке →
//- подсказка → каркас загрузки → пустое состояние → строки пакетов.
//- Строка: опознание (пакет, дата регистрации) → деньги (цена в месяц, под
//- ней пробный срок) → состояние (шаг пути к каталогу, под ним только новое)
//- → действие (следующий шаг издателя). Нажатие открывает панель пакета.
.q-pa-md
  PageHint.q-mb-md(storage-key='developer:my-packages:hint-dismissed')
    | {{ $t('developer.myPackages.intro') }}

  BaseBanner.q-mb-md(v-if='error', variant='neg') {{ error }}

  CardListSkeleton(v-else-if='firstLoad', :count='2')

  EmptyState(
    v-else-if='!packages.length',
    :title="$t('developer.myPackages.emptyTitle')",
    :body="$t('developer.myPackages.emptyBody')"
  )
    template(#icon)
      q-icon(name='inventory_2', size='32px')

  .my-packages__list(v-else)
    PackageRow(
      v-for='pkg in packages',
      :key='pkg.packageId',
      :title='pkg.packageId',
      :meta="$t('developer.myPackages.registeredAt', { date: formatDate(pkg.registeredAt) })",
      :sum="hasPrice(pkg) ? priceLabel(pkg) : ''",
      :sum-caption='trialLabel(pkg)',
      :badge-label='STAGES[pkg.stage].label',
      :badge-variant='STAGES[pkg.stage].variant',
      :state-note='stageNote(pkg)',
      @open='openPackage(pkg)'
    )
      template(v-if='nextStep(pkg)', #actions)
        BaseButton(variant='secondary', size='sm', @click='nextStep(pkg)?.run()') {{ nextStep(pkg)?.label }}

  //- Панель пакета: состояние → цена крупно → путь к каталогу (пока выпуска
  //- нет) → факты → ключи выпуска → команда обновления. Действия — в подвале.
  DetailsDrawer(v-model='drawerOpen', :title="current ? current.packageId : ''", :width='520')
    template(v-if='current')
      .my-packages__head
        BaseBadge(:variant='STAGES[current.stage].variant') {{ STAGES[current.stage].label }}
        .my-packages__price(v-if='hasPrice(current)')
          .my-packages__price-sum {{ priceLabel(current) }}
          .my-packages__price-caption {{ trialLabel(current) }}

      //- Путь к каталогу: пройденные шаги отмечены, у текущего — одно действие.
      .my-packages__section(v-if="current.stage !== 'active'")
        .t-eyebrow.q-mb-sm {{ $t('developer.path.title') }}
        VerticalStepper(:steps='pathSteps', :active-key='activeStep(current)', :completed='completedSteps(current)')
          template(#active='{ step }')
            template(v-if="step.key === 'release'")
              DataRow(:label="$t('developer.path.createCommand')", :value='createCommand(current)', align='vertical', mono, copyable)
              DataRow(:label="$t('developer.path.publishCommand')", :value='publishCommand(current)', align='vertical', mono, copyable)
              BaseButton.q-mt-sm(variant='secondary', size='sm', @click='openGuide') {{ $t('developer.myPackages.openGuide') }}

      .my-packages__section
        DataRow(
          v-if='current.pricing && current.pricing.lastActiveVersion',
          align='spread',
          :label="$t('developer.myPackages.versionLabel')",
          :value='current.pricing.lastActiveVersion'
        )
        DataRow(align='spread', :label="$t('developer.myPackages.registeredLabel')", :value='formatDate(current.registeredAt)')
        DataRow(
          v-if="current.stage === 'active'",
          :label="$t('developer.path.updateCommand')",
          :value='publishCommand(current)',
          :hint="$t('developer.path.updateHint')",
          align='vertical',
          mono,
          copyable
        )

      .my-packages__section
        .t-eyebrow.q-mb-sm {{ $t('developer.keys.title') }}
        q-list(v-if='current.tokens.length', separator)
          q-item.my-packages__key(v-for='token in current.tokens', :key='token.id')
            q-item-section
              .text-weight-medium {{ token.label }}
              .t-meta.t-muted
                span.t-mono {{ token.tokenPrefix }}…
                |
                | · {{ formatDate(token.createdAt) }}
            q-item-section(side)
              .my-packages__key-side
                BaseBadge(:variant='tokenState(token).variant') {{ tokenState(token).label }}
                BaseButton(
                  v-if='isLiveToken(token)',
                  variant='secondary',
                  size='sm',
                  :loading='isSubmitting',
                  @click='revokeKey(token)'
                ) {{ $t('developer.keys.revoke') }}
        .t-sm.t-muted(v-else) {{ $t('developer.keys.empty') }}

    template(v-if='current', #footer)
      .my-packages__footer
        BaseButton(variant='secondary', @click='openIssue(current)')
          template(#icon-left)
            q-icon(name='key', size='18px')
          | {{ $t('developer.keys.issue') }}
        q-space
        BaseButton(v-if='current.pricing', variant='primary', @click='openPrice(current)')
          | {{ hasPrice(current) ? $t('developer.price.change') : $t('developer.price.set') }}

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
      DataRow(:label="$t('developer.keys.keyLabel')", :value='issuedToken', align='vertical', mono, copyable)
      DataRow(
        :label="$t('developer.path.publishCommand')",
        :value='issuePublishCommand',
        :hint="$t('developer.keys.nextStep')",
        align='vertical',
        mono,
        copyable
      )
    template(#footer)
      template(v-if='!issuedToken')
        BaseButton(variant='ghost', :disabled='isSubmitting', @click='issueDialog = false') {{ $t('common.action.cancel') }}
        BaseButton(variant='primary', :loading='isSubmitting', @click='confirmIssue') {{ $t('developer.keys.issueSubmit') }}
      BaseButton(v-else, variant='primary', @click='issueDialog = false') {{ $t('developer.keys.done') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BaseBadge, BaseBanner, BaseButton, BaseDialog, BaseInput, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { AmountInput, DataRow, DetailsDrawer, PageHint, VerticalStepper } from 'src/shared/ui/domain';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper/VerticalStepper.types';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { useHeaderActions } from 'src/shared/hooks';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { isLiveToken, useMyPackages, type IMyPackage, type IMyToken, type PackageStage } from '../features/MyPackages/model';
import { formatDate, formatRub } from '../shared/lib/format';
import PackageRow from '../shared/ui/PackageRow.vue';
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

/** Состояние пакета: бейдж называет шаг один раз, строка под ним добавляет только новое. */
const STAGES: Record<PackageStage, { label: string; variant: BaseBadgeVariant }> = {
  registered: { label: t('developer.stage.registered'), variant: 'neutral' },
  needsPrice: { label: t('developer.stage.needsPrice'), variant: 'warn' },
  moderation: { label: t('developer.stage.moderation'), variant: 'info' },
  active: { label: t('developer.stage.active'), variant: 'pos' },
};

function stageNote(pkg: IMyPackage): string {
  if (pkg.stage === 'active') return t('developer.stage.activeNote', { version: pkg.pricing?.lastActiveVersion ?? '' });
  if (pkg.stage === 'registered') return hasLiveKey(pkg) ? t('developer.stage.keyIssued') : t('developer.stage.noKey');
  return '';
}

const hasLiveKey = (pkg: IMyPackage) => pkg.tokens.some(isLiveToken);

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

function tokenState(token: IMyToken): { label: string; variant: BaseBadgeVariant } {
  if (token.revokedAt) return { label: t('developer.keys.state.revoked'), variant: 'neutral' };
  if (!isLiveToken(token)) return { label: t('developer.keys.state.expired'), variant: 'warn' };
  return { label: t('developer.keys.state.active'), variant: 'pos' };
}

const createCommand = (pkg: IMyPackage) => `./create-app ${pkg.name} "${t('developer.guide.appTitleSample')}"`;
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

/** Действие строки — следующий шаг издателя; у шага без действия на столе кнопки нет. */
function nextStep(pkg: IMyPackage): { label: string; run: () => void } | null {
  if (pkg.stage === 'registered') {
    return hasLiveKey(pkg) ? null : { label: t('developer.keys.issue'), run: () => openIssue(pkg) };
  }
  if (pkg.stage === 'needsPrice') return { label: t('developer.price.set'), run: () => openPrice(pkg) };
  return null;
}

// ── Путь пакета к каталогу ─────────────────────────────────────────────────
/** Шаги пути: ключ → первый выпуск → цена → модерация. Регистрация пройдена у любого пакета списка. */
const pathSteps: StepperStep[] = [
  { key: 'key', label: t('developer.path.key'), description: t('developer.path.keyText') },
  { key: 'release', label: t('developer.path.release'), description: t('developer.path.releaseText') },
  { key: 'price', label: t('developer.path.price'), description: t('developer.path.priceText') },
  { key: 'moderation', label: t('developer.path.moderation'), description: t('developer.path.moderationText') },
];

/** Текущий шаг пути: то, что издатель делает сейчас. */
function activeStep(pkg: IMyPackage): string {
  if (pkg.stage === 'registered') return hasLiveKey(pkg) ? 'release' : 'key';
  return pkg.stage === 'needsPrice' ? 'price' : 'moderation';
}

/** Пройденные шаги — все до текущего. */
function completedSteps(pkg: IMyPackage): string[] {
  const keys = pathSteps.map((step) => step.key);
  return keys.slice(0, keys.indexOf(activeStep(pkg)));
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
.my-packages__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.my-packages__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-3);
}
.my-packages__price-sum {
  font-size: var(--p-fs-h1);
  font-weight: 700;
  line-height: var(--p-lh-h1);
  font-variant-numeric: tabular-nums;
}
.my-packages__price-caption {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
.my-packages__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.my-packages__key {
  padding-left: 0;
  padding-right: 0;
}
.my-packages__key-side {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}
.my-packages__footer {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
}
</style>
