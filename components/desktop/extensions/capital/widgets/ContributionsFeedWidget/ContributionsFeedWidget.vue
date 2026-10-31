<template lang="pug">
.contrib-feed
  //- Журнал взносов — таблицей, как реестр выплат: записи сравнивают по
  //- колонкам, подробности открывает правая панель по нажатию на строку.
  BaseTable(
    v-if='firstLoad || items.length',
    :columns='columns',
    :rows='items',
    row-key='key',
    hover,
    clickable-rows,
    :loading='firstLoad',
    min-width='720px',
    @row-click='open'
  )
    template(#cell-title='{ row }')
      .contrib-feed__title {{ row.title }}
      .contrib-feed__subject(v-if='row.subject') {{ row.subject }}
    template(#cell-status='{ row }')
      BaseBadge(:variant='row.status.variant') {{ row.status.label }}
    //- Ход за пайщиком — кнопка прямо в строке, без захода в панель.
    template(#cell-actions='{ row }')
      BaseButton(
        v-if='row.needsAction && row.property && canSignAct(row.property)',
        variant='secondary',
        size='sm',
        :loading='signingKey === row.key',
        @click.stop='sign(row.property, row.key)'
      ) {{ $t('capital.contributionsFeed.signAct') }}

  EmptyState(
    v-else,
    :title='$t("capital.contributionsFeed.emptyTitle")',
    :body='$t("capital.contributionsFeed.emptyBody")'
  )
    template(#icon)
      q-icon(name='volunteer_activism', size='48px')

  .row.justify-center(v-if='hasMore')
    BaseButton(variant='ghost', :loading='loading', @click='loadMore') {{ $t('capital.contributionsFeed.loadMore') }}

  DetailsDrawer(
    :model-value='!!selected',
    :width='640',
    :title='selected?.title ?? ""',
    @update:model-value='(v) => !v && (selectedKey = null)'
  )
    .contrib-detail(v-if='selected')
      .contrib-detail__head
        .contrib-detail__amount.t-mono {{ formatAsset2Digits(selected.amount) }}
        BaseBadge(:variant='selected.status.variant') {{ selected.status.label }}
      .contrib-detail__note(v-if='selected.status.note') {{ selected.status.note }}

      DataRow(:label='$t("capital.contributionsFeed.dateLabel")', :value='formatDateToHumanDateTime(selected.date)')

      template(v-if='selected.property')
        DataRow(:label='$t("capital.contributionsFeed.nameLabel")', :value='selected.property.property_name || "______"')
        DataRow(:label='$t("capital.contributionsFeed.formLabel")', :value='formLabelOf(selected.property)')
        DataRow(:label='$t("capital.contributionsFeed.quantityLabel")', :value='quantityOf(selected.property)')
        DataRow(
          :label='$t("capital.contributionsFeed.descriptionLabel")',
          :value='selected.property.property_details || selected.property.property_description',
          align='vertical'
        )

        template(v-if='selected.property.status !== Status.DECLINED')
          .contrib-detail__section {{ $t('capital.contributionsFeed.progressSection') }}
          VerticalStepper(:steps='steps', :active-key='stepOf(selected.property).active', :completed='stepOf(selected.property).completed')

        template(v-if='documentsOf(selected.property).length')
          .contrib-detail__section {{ $t('capital.contributionsFeed.documentsSection') }}
          ComplexDocument(v-for='(doc, i) in documentsOf(selected.property)', :key='i', :document='doc', collapsible)

      DataRow(
        v-if='selected.contribution',
        :label='$t("capital.contributionsFeed.operationLabel")',
        :value='selected.contribution.id',
        copyable,
        mono
      )

    template(#footer, v-if='selected?.property && canSignAct(selected.property)')
      BaseButton(variant='primary', :loading='signingKey === selected.key', @click='sign(selected.property, selected.key)') {{ $t('capital.contributionsFeed.signAct') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CapitalContract, Ledger2Contract } from 'cooptypes';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, VerticalStepper, type StepperStep } from 'src/shared/ui/domain';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useFirstLoad } from 'src/shared/lib/composables';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatDateToHumanDateTime } from 'src/shared/lib/utils/dates/formatDateToHumanDateTime';
import { useSessionStore } from 'src/entities/Session';
import { programPropertyApi, useProgramProperty, type IProgramProperty } from 'app/extensions/capital/features/ProgramProperty';
import { contributionApi, type IContribution } from 'app/extensions/capital/entities/Contribution';
import { refreshMenuBadges } from 'src/shared/lib/menuBadges';
import { buildFeed, type FeedItem } from './feed';
import { CONTRIBUTIONS_ROUTE } from './attention';
import { t } from '../../i18n';

const Status = Zeus.ProgramPropertyStatus;
const PAGE_SIZE = 50;

const session = useSessionStore();
const { signAct } = useProgramProperty();
const signingKey = ref<string | null>(null);

const properties = ref<IProgramProperty[]>([]);
const contributions = ref<IContribution[]>([]);
const ledgerPages = ref(1);
const ledgerTotalPages = ref(0);
// true до первого запроса: первый кадр показывает каркас, а не «пусто»
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const hasMore = computed(() => ledgerPages.value < ledgerTotalPages.value);

const items = computed(() => buildFeed(properties.value, contributions.value));
const selectedKey = ref<string | null>(null);
const selected = computed<FeedItem | null>(() => items.value.find((i) => i.key === selectedKey.value) ?? null);

const columns: BaseTableColumn<FeedItem>[] = [
  { key: 'date', label: t('capital.contributionsFeed.column.date'), field: (row) => formatDateToHumanDateTime(row.date), width: '180px', nowrap: true },
  { key: 'title', label: t('capital.contributionsFeed.column.contribution'), field: (row) => row.title },
  { key: 'amount', label: t('capital.contributionsFeed.column.amount'), field: (row) => formatAsset2Digits(row.amount), numeric: true, nowrap: true, width: '170px' },
  { key: 'status', label: t('capital.contributionsFeed.column.status'), field: (row) => row.status.label, nowrap: true, width: '320px' },
  { key: 'actions', label: '', field: () => '', nowrap: true, width: '170px', align: 'right' },
];

const steps = computed<StepperStep[]>(() => [
  { key: 'statement', label: t('capital.contributionsFeed.step.statement') },
  { key: 'chairman', label: t('capital.contributionsFeed.step.chairman') },
  { key: 'council', label: t('capital.contributionsFeed.step.council') },
  { key: 'act1', label: t('capital.contributionsFeed.step.act1') },
  { key: 'act2', label: t('capital.contributionsFeed.step.act2') },
]);
const STEP_ORDER = ['statement', 'chairman', 'council', 'act1', 'act2'];
/** Сколько шагов процесса пройдено при каждом статусе. */
const DONE_BY_STATUS: Record<string, number> = {
  [Status.CREATED]: 1,
  [Status.APPROVED]: 2,
  [Status.AUTHORIZED]: 3,
  [Status.ACT1]: 4,
  [Status.ACT2]: 5,
};

function stepOf(p: IProgramProperty): { active: string; completed: string[] } {
  const done = DONE_BY_STATUS[p.status] ?? 0;
  return { active: STEP_ORDER[Math.min(done, STEP_ORDER.length - 1)], completed: STEP_ORDER.slice(0, done) };
}

function canSignAct(p: IProgramProperty): boolean {
  return p.status === Status.AUTHORIZED && p.username === session.username;
}

function quantityOf(p: IProgramProperty): string {
  return [p.property_quantity, p.property_unit].filter(Boolean).join(' ') || '______';
}

function formLabelOf(p: IProgramProperty): string {
  return p.property_form === 'intangible' ? t('capital.contributionsFeed.form.intangible') : t('capital.contributionsFeed.form.thing');
}

function documentsOf(p: IProgramProperty) {
  return [p.statement, p.authorization, p.act].filter((d): d is NonNullable<typeof d> => !!d);
}

function open(row: FeedItem): void {
  selectedKey.value = row.key;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    // Дочитка по ленте перечитывает уже открытые страницы, а не сбрасывает список на первую.
    const [props, ...pages] = await Promise.all([
      programPropertyApi.loadProgramProperties({ filter: { username: session.username }, options: { page: 1, limit: 100, sortOrder: 'DESC' } }),
      ...Array.from({ length: ledgerPages.value }, (_, i) =>
        contributionApi.loadContributions({ filter: { username: session.username }, options: { page: i + 1, limit: PAGE_SIZE, sortOrder: 'DESC' } }),
      ),
    ]);
    properties.value = props.items;
    contributions.value = pages.flatMap((p) => p.items);
    ledgerTotalPages.value = pages[pages.length - 1]?.totalPages ?? 0;
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  ledgerPages.value += 1;
  await load();
}

async function sign(p: IProgramProperty, key: string): Promise<void> {
  signingKey.value = key;
  try {
    await signAct(p);
    SuccessAlert(t('capital.contributionsFeed.signed'));
    await live.refresh();
    void refreshMenuBadges([CONTRIBUTIONS_ROUTE]);
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    signingKey.value = null;
  }
}

// Строка взноса имуществом в цепи, его итог в базе узла (принято / отклонено
// пишется после удаления строки) и кошельки пайщика в книге учёта.
const live = useLiveReload(
  [
    liveTable(CapitalContract, CapitalContract.Tables.ProgramProperties),
    { code: 'capital', table: 'capital_program_properties' },
    liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
  ],
  load,
);

onMounted(load);

defineExpose({ reload: () => live.refresh() });
</script>

<style scoped lang="scss">
.contrib-feed {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);

  &__title {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__subject {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }
}

.contrib-detail {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3);
  }

  &__amount {
    font-size: var(--p-fs-h1);
    font-weight: 600;
  }

  &__note {
    color: var(--p-ink-3);
    margin-bottom: var(--p-2);
  }

  &__section {
    margin-top: var(--p-4);
    color: var(--p-ink-3);
    font-size: var(--p-fs-eyebrow);
    line-height: var(--p-lh-eyebrow);
    text-transform: uppercase;
    letter-spacing: var(--p-ls-eyebrow);
  }
}
</style>
