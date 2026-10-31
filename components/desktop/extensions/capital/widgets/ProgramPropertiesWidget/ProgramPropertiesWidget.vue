<template lang="pug">
.property-list
  CardListSkeleton(v-if='firstLoad', :count='2')

  EmptyState(
    v-if='!firstLoad && !items.length',
    :title='$t("capital.programPropertiesWidget.emptyTitle")',
    :body='$t("capital.programPropertiesWidget.emptyBody")'
  )
    template(#icon)
      q-icon(name='inventory_2', size='48px')

  //- Зоны строки: опознание — «что передаётся», деньги — «во сколько оценено»,
  //- состояние — «где взнос сейчас», действия — «что сделать пайщику».
  .property-row(
    v-for='p in items',
    :key='p.property_hash',
    role='button',
    tabindex='0',
    @click='openDetails(p)',
    @keydown.enter='openDetails(p)'
  )
    .property-row__identity
      .property-row__title {{ titleOf(p) }}
      .property-row__meta {{ $t('capital.programPropertiesWidget.meta', { number: shortNumber(p), date: formatDate(p.created_at) }) }}
    .property-row__money
      .property-row__amount {{ formatAsset2Digits(p.property_amount) }}
      .property-row__caption {{ $t('capital.programPropertiesWidget.amountCaption') }}
    .property-row__state
      BaseBadge(:variant='stateOf(p).variant') {{ stateOf(p).label }}
      .property-row__note(v-if='stateOf(p).note') {{ stateOf(p).note }}
    .property-row__actions
      BaseButton(
        v-if='canSignAct(p)',
        variant='primary',
        size='sm',
        :loading='isSubmitting && signingHash === p.property_hash',
        @click.stop='sign(p)'
      ) {{ $t('capital.programPropertiesWidget.signAct') }}
      BaseButton(v-else, variant='secondary', size='sm', @click.stop='openDetails(p)') {{ $t('capital.programPropertiesWidget.details') }}

  DetailsDrawer(v-model='drawerOpen', :title='selected ? titleOf(selected) : ""')
    template(v-if='selected')
      .property-details
        BaseBadge(:variant='stateOf(selected).variant') {{ stateOf(selected).label }}
        div
          .property-details__eyebrow {{ $t('capital.programPropertiesWidget.amountCaption') }}
          .property-details__amount {{ formatAsset2Digits(selected.property_amount) }}
        DataRow(
          :label='$t("capital.programPropertiesWidget.quantityLabel")',
          :value='quantityOf(selected)',
          align='spread'
        )
        DataRow(:label='$t("capital.programPropertiesWidget.createdLabel")', :value='formatDate(selected.created_at)', align='spread')
        DataRow(
          :label='$t("capital.programPropertiesWidget.descriptionLabel")',
          :value='selected.property_details || selected.property_description',
          align='vertical'
        )
        VerticalStepper(
          v-if='selected.status !== ProgramPropertyStatus.DECLINED',
          :steps='steps',
          :active-key='stepOf(selected).active',
          :completed='stepOf(selected).completed'
        )
        ComplexDocument(v-if='selected.statement', :document='selected.statement', collapsible)
        ComplexDocument(v-if='selected.authorization', :document='selected.authorization', collapsible)
        ComplexDocument(v-if='selected.act', :document='selected.act', collapsible)
    template(#footer, v-if='selected && canSignAct(selected)')
      BaseButton(variant='primary', :loading='isSubmitting', @click='sign(selected)') {{ $t('capital.programPropertiesWidget.signAct') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CapitalContract } from 'cooptypes';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge, BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, VerticalStepper, type StepperStep } from 'src/shared/ui/domain';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useFirstLoad } from 'src/shared/lib/composables';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { uiLocale } from 'src/shared/i18n';
import { useSessionStore } from 'src/entities/Session';
import { programPropertyApi, useProgramProperty, type IProgramProperty } from 'app/extensions/capital/features/ProgramProperty';
import { t } from '../../i18n';

const ProgramPropertyStatus = Zeus.ProgramPropertyStatus;

const session = useSessionStore();
const { signAct, isSubmitting } = useProgramProperty();

const items = ref<IProgramProperty[]>([]);
// true до первого запроса: первый кадр показывает каркас, а не «пусто»
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

const drawerOpen = ref(false);
const selectedHash = ref<string | null>(null);
const selected = computed(() => items.value.find((p) => p.property_hash === selectedHash.value) ?? null);
const signingHash = ref<string | null>(null);

interface PropertyState {
  label: string;
  variant: BaseBadgeVariant;
  note?: string;
}

// Состояние называется один раз: бейдж — где взнос, строка под ним — что дальше.
function stateOf(p: IProgramProperty): PropertyState {
  switch (p.status) {
    case ProgramPropertyStatus.CREATED:
      return { label: t('capital.programPropertiesWidget.status.created'), variant: 'info', note: t('capital.programPropertiesWidget.note.created') };
    case ProgramPropertyStatus.APPROVED:
      return { label: t('capital.programPropertiesWidget.status.approved'), variant: 'info', note: t('capital.programPropertiesWidget.note.approved') };
    case ProgramPropertyStatus.AUTHORIZED:
      return { label: t('capital.programPropertiesWidget.status.authorized'), variant: 'warn', note: t('capital.programPropertiesWidget.note.authorized') };
    case ProgramPropertyStatus.ACT1:
      return { label: t('capital.programPropertiesWidget.status.act1'), variant: 'info', note: t('capital.programPropertiesWidget.note.act1') };
    case ProgramPropertyStatus.ACT2:
      return { label: t('capital.programPropertiesWidget.status.act2'), variant: 'pos' };
    case ProgramPropertyStatus.DECLINED:
      return { label: t('capital.programPropertiesWidget.status.declined'), variant: 'neg' };
    default:
      return { label: t('capital.programPropertiesWidget.status.unknown'), variant: 'neutral' };
  }
}

const steps = computed<StepperStep[]>(() => [
  { key: 'statement', label: t('capital.programPropertiesWidget.step.statement') },
  { key: 'chairman', label: t('capital.programPropertiesWidget.step.chairman') },
  { key: 'council', label: t('capital.programPropertiesWidget.step.council') },
  { key: 'act1', label: t('capital.programPropertiesWidget.step.act1') },
  { key: 'act2', label: t('capital.programPropertiesWidget.step.act2') },
]);

const STEP_ORDER = ['statement', 'chairman', 'council', 'act1', 'act2'];
/** Сколько шагов процесса пройдено при каждом статусе. */
const DONE_BY_STATUS: Record<string, number> = {
  [ProgramPropertyStatus.CREATED]: 1,
  [ProgramPropertyStatus.APPROVED]: 2,
  [ProgramPropertyStatus.AUTHORIZED]: 3,
  [ProgramPropertyStatus.ACT1]: 4,
  [ProgramPropertyStatus.ACT2]: 5,
};

function stepOf(p: IProgramProperty): { active: string; completed: string[] } {
  const done = DONE_BY_STATUS[p.status] ?? 0;
  return { active: STEP_ORDER[Math.min(done, STEP_ORDER.length - 1)], completed: STEP_ORDER.slice(0, done) };
}

function canSignAct(p: IProgramProperty): boolean {
  return p.status === ProgramPropertyStatus.AUTHORIZED && p.username === session.username;
}

function titleOf(p: IProgramProperty): string {
  return p.property_name || p.property_description || t('capital.programPropertiesWidget.untitled');
}

function shortNumber(p: IProgramProperty): string {
  return p.property_hash.slice(0, 8).toUpperCase();
}

function quantityOf(p: IProgramProperty): string {
  return [p.property_quantity, p.property_unit].filter(Boolean).join(' ') || '______';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(uiLocale());
}

function openDetails(p: IProgramProperty): void {
  selectedHash.value = p.property_hash;
  drawerOpen.value = true;
}

async function load(): Promise<void> {
  try {
    const page = await programPropertyApi.loadProgramProperties({
      filter: { username: session.username },
      options: { page: 1, limit: 100, sortOrder: 'DESC' },
    });
    items.value = page.items;
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function sign(p: IProgramProperty): Promise<void> {
  signingHash.value = p.property_hash;
  try {
    await signAct(p);
    SuccessAlert(t('capital.programPropertiesWidget.signed'));
    await live.refresh();
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    signingHash.value = null;
  }
}

// Строка взноса в цепи и итог в базе узла (принято / отклонено пишется после
// удаления строки) — экран перечитывается по обеим лентам.
const live = useLiveReload(
  [liveTable(CapitalContract, CapitalContract.Tables.ProgramProperties), { code: 'capital', table: 'capital_program_properties' }],
  load,
);

onMounted(load);

defineExpose({ reload: () => live.refresh() });
</script>

<style scoped lang="scss">
.property-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.property-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--p-6);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
  background: var(--p-surface);
  cursor: pointer;

  &:hover {
    border-color: var(--p-line-2);
  }

  &__title {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta,
  &__caption,
  &__note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__money {
    text-align: right;
  }

  &__amount {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
    white-space: nowrap;
  }

  &__state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--p-1);
  }
}

.property-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__eyebrow {
    font-size: var(--p-fs-eyebrow);
    color: var(--p-ink-3);
  }

  &__amount {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
  }
}

// Узкий экран — та же разметка в два яруса
@media (max-width: 768px) {
  .property-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'identity money'
      'state actions';
    gap: var(--p-3);

    &__identity { grid-area: identity; }
    &__money { grid-area: money; }
    &__state { grid-area: state; }
    &__actions { grid-area: actions; }
  }
}
</style>
