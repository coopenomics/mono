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
  //- нет) → команда обновления. Ключи API — отдельная страница стола.
  DetailsDrawer(v-model='drawerOpen', :title="current ? current.packageId : ''", :width='520')
    template(v-if='current')
      .my-packages__head
        BaseBadge(:variant='STAGES[current.stage].variant') {{ STAGES[current.stage].label }}
        .my-packages__price(v-if='hasPrice(current)')
          .my-packages__price-sum {{ priceLabel(current) }}
          .my-packages__price-caption {{ trialLabel(current) }}
        .t-sm.t-muted {{ $t('developer.myPackages.registeredAt', { date: formatDate(current.registeredAt) }) }}

      //- Путь к каталогу: пройденные шаги отмечены, у текущего — одно действие.
      .my-packages__section(v-if="current.stage !== 'active'")
        .t-eyebrow.q-mb-sm {{ $t('developer.path.title') }}
        VerticalStepper(:steps='pathSteps', :active-key='activeStep(current)', :completed='completedSteps(current)')
          template(#active='{ step }')
            BaseButton(v-if="step.key === 'price'", variant='secondary', size='sm', @click='openPrice(current)') {{ $t('developer.price.set') }}
            BaseButton(v-if="step.key === 'key'", variant='secondary', size='sm', @click='openKeys(current)') {{ $t('developer.keys.issue') }}
            template(v-if="step.key === 'release'")
              DataRow(:label="$t('developer.path.createCommand')", :value='createCommand(current)', align='vertical', mono, copyable)
              DataRow(
                :label="$t('developer.path.publishCommand')",
                :value='publishCommand',
                :hint="$t('developer.path.publishHint', { name: current.name })",
                align='vertical',
                mono,
                copyable
              )
              BaseButton.q-mt-sm(variant='secondary', size='sm', @click='openGuide') {{ $t('developer.myPackages.openGuide') }}

      //- Действующий пакет: версия и команда обновления.
      .my-packages__section(v-if="current.stage === 'active'")
        DataRow(
          align='spread',
          :label="$t('developer.myPackages.versionLabel')",
          :value="current.pricing ? current.pricing.lastActiveVersion : ''"
        )
        DataRow(
          :label="$t('developer.path.updateCommand')",
          :value='publishCommand',
          :hint="$t('developer.path.updateHint')",
          align='vertical',
          mono,
          copyable
        )

    template(v-if='current', #footer)
      .my-packages__footer
        BaseButton(variant='secondary', @click='openKeys(current)')
          template(#icon-left)
            q-icon(name='key', size='18px')
          | {{ current.hasKey ? $t('developer.myPackages.openKeys') : $t('developer.keys.issue') }}
        q-space
        BaseButton(variant='primary', @click='openPrice(current)')
          | {{ hasPrice(current) ? $t('developer.price.change') : $t('developer.price.set') }}

  //- Регистрация: имя пакета и цена одним шагом — цену каталог принимает до
  //- первого выпуска, без цены модератор выпуск не одобрит. Поля — колонкой
  //- с интервалом, цена и пробный срок — рядом.
  BaseDialog(v-model='registerDialog', :title="$t('developer.register.title')", size='lg')
    .package-form
      p.t-sm.t-muted.package-form__text {{ $t('developer.register.text') }}
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
      PackagePriceFields(
        v-model:rub-per-month='registerPrice.rubPerMonth',
        v-model:trial-days='registerPrice.trialDays',
        :errors='registerPriceErrors'
      )
      BaseBanner(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='registerDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='isSubmitting', @click='confirmRegister') {{ $t('developer.register.submit') }}

  BaseDialog(v-model='priceDialog', :title="$t('developer.price.dialogTitle')", size='lg')
    .package-form
      p.t-sm.t-muted.package-form__text {{ $t('developer.price.text') }}
      PackagePriceFields(
        v-model:rub-per-month='priceForm.rubPerMonth',
        v-model:trial-days='priceForm.trialDays',
        :errors='priceErrors'
      )
      BaseBanner(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='priceDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='isSubmitting', @click='confirmPrice') {{ $t('developer.price.save') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BaseBadge, BaseBanner, BaseButton, BaseDialog, BaseInput, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { DataRow, DetailsDrawer, PageHint, VerticalStepper } from 'src/shared/ui/domain';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper/VerticalStepper.types';
import { useFirstLoad } from 'src/shared/lib/composables';
import { APPS_CATALOG_LIVE, useLiveReload } from 'src/shared/lib/realtime';
import { useHeaderActions } from 'src/shared/hooks';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useMyPackages, type IMyPackage, type PackageStage } from '../features/MyPackages/model';
import { formatDate, formatRub } from '../shared/lib/format';
import PackageRow from '../shared/ui/PackageRow.vue';
import HeaderActionButton from '../shared/ui/HeaderActionButton.vue';
import PackagePriceFields from '../shared/ui/PackagePriceFields.vue';
import { kitCreateCommand, kitPublishCommand } from '../shared/lib/kitCommands';
import { api as catalogApi } from '../features/CatalogAddress/api';
import { t } from '../i18n';

/**
 * «Мои пакеты»: пайщик регистрирует пакет на себя сразу с ценой и видит, на
 * каком шаге пути к каталогу стоит каждый пакет. Ключи API — отдельная
 * страница стола (487-37). Выпуск версии идёт из терминала набором издателя:
 * страница даёт готовые команды, формы выпуска в интерфейсе нет.
 */

/** Имя приложения: то же правило, что у команды create набора издателя @coopenomics/app-kit. */
const APP_NAME_RE = /^[a-z][a-z1-5]{1,11}$/;
/** Верхняя граница цены, ₽ в месяц: та же, что у каталога приложений. */
const PRICE_MAX_RUB = 1_000_000;
/** Верхняя граница пробного срока, дней. */
const TRIAL_MAX_DAYS = 365;

const router = useRouter();
const session = useSessionStore();
const systemStore = useSystemStore();
const { registerAction } = useHeaderActions();
const { packages, loading, error, isSubmitting, actionError, load, register, setPrice } = useMyPackages();
const firstLoad = useFirstLoad(loading);
// Живое обновление по ленте узла: регистрация пакета, цена, решение
// модератора и выпуск из терминала (сигнал ядра по опросу каталога), ключи API.
useLiveReload([APPS_CATALOG_LIVE.publishers, APPS_CATALOG_LIVE.packages, APPS_CATALOG_LIVE.keys], load);

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
  if (pkg.stage === 'registered') return pkg.hasKey ? t('developer.stage.keyIssued') : t('developer.stage.noKey');
  return '';
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

/** Адрес каталога узла для команд набора; `null` — адрес узлу не задан. */
const catalogUrl = ref<string | null>(null);
const createCommand = (pkg: IMyPackage) =>
  kitCreateCommand(pkg.packageId, t('developer.guide.appTitleSample'), catalogUrl.value);
// Команда выпуска одна для любого пакета: пакет определяет папка приложения.
const publishCommand = kitPublishCommand();

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

/** Ключи API: без ключа на пакет — сразу выпуск с отмеченным пакетом. */
function openKeys(pkg: IMyPackage) {
  drawerOpen.value = false;
  void router.push({ name: 'developer-api-keys', query: pkg.hasKey ? {} : { issue: pkg.packageId } });
}

/** Действие строки — текущий шаг пути; у шага без действия на столе кнопки нет. */
function nextStep(pkg: IMyPackage): { label: string; run: () => void } | null {
  const step = activeStep(pkg);
  if (step === 'price') return { label: t('developer.price.set'), run: () => openPrice(pkg) };
  if (step === 'key') return { label: t('developer.keys.issue'), run: () => openKeys(pkg) };
  return null;
}

// ── Путь пакета к каталогу ─────────────────────────────────────────────────
/**
 * Шаги пути: цена → ключ API → первый выпуск → модерация. Регистрация пройдена
 * у любого пакета списка. Цену назначают при регистрации, поэтому она первая.
 */
const pathSteps: StepperStep[] = [
  { key: 'price', label: t('developer.path.price'), description: t('developer.path.priceText') },
  { key: 'key', label: t('developer.path.key'), description: t('developer.path.keyText') },
  { key: 'release', label: t('developer.path.release'), description: t('developer.path.releaseText') },
  { key: 'moderation', label: t('developer.path.moderation'), description: t('developer.path.moderationText') },
];

/** Пройденные шаги — по фактам пакета, а не по порядку. */
function completedSteps(pkg: IMyPackage): string[] {
  const done: Record<string, boolean> = {
    price: hasPrice(pkg),
    key: pkg.hasKey,
    release: Boolean(pkg.pricing?.inCatalog),
    moderation: pkg.stage === 'active',
  };
  return pathSteps.map((step) => step.key).filter((key) => done[key]);
}

/** Текущий шаг пути: первый непройденный. */
function activeStep(pkg: IMyPackage): string {
  const done = completedSteps(pkg);
  return pathSteps.find((step) => !done.includes(step.key))?.key ?? 'moderation';
}

// ── Регистрация пакета ─────────────────────────────────────────────────────
const registerDialog = ref(false);
const registerName = ref('');
const registerError = ref('');
const registerPrice = reactive<{ rubPerMonth: number | string | null; trialDays: number | string | null }>({
  rubPerMonth: null,
  trialDays: 0,
});
const registerPriceErrors = reactive({ rubPerMonth: '', trialDays: '' });

function openRegister() {
  registerName.value = '';
  registerError.value = '';
  registerPrice.rubPerMonth = null;
  registerPrice.trialDays = 0;
  registerPriceErrors.rubPerMonth = '';
  registerPriceErrors.trialDays = '';
  actionError.value = null;
  registerDialog.value = true;
}

async function confirmRegister() {
  const name = registerName.value.trim();
  const rubPerMonth = parsePrice(registerPrice.rubPerMonth);
  const trialDays = parseDays(registerPrice.trialDays, 0, 0, TRIAL_MAX_DAYS);
  registerError.value = APP_NAME_RE.test(name) ? '' : t('developer.register.nameFormat');
  registerPriceErrors.rubPerMonth = rubPerMonth === null ? t('developer.price.priceRange') : '';
  registerPriceErrors.trialDays = trialDays === null ? t('developer.price.trialRange') : '';
  if (registerError.value || rubPerMonth === null || trialDays === null) return;
  const packageId = `${packagePrefix.value}${name}`;
  if (!(await register(session.username, packageId, { rubPerMonth, trialDays }))) return;
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

onMounted(async () => {
  registerAction({
    id: 'developer:register-package',
    component: HeaderActionButton,
    props: { label: t('developer.register.action'), icon: 'add', onClick: openRegister },
  });
  await load();
  catalogUrl.value = await catalogApi.publicCatalogUrl().catch(() => null);
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
.package-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.package-form__text {
  margin: 0;
}
.my-packages__footer {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
}
</style>
