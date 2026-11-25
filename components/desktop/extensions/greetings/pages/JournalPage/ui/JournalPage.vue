<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key='greetings:journal:hint' variant='info' icon='history')
    | {{ $t('greetings.journal.hint') }}

  EmptyState(
    v-if='!firstLoad && !rows.length'
    :title='$t("greetings.journal.emptyTitle")'
    :body='$t("greetings.journal.emptyBody")'
  )
    template(#icon)
      q-icon(name='history' size='32px')

  template(v-else)
    BaseTable(
      :columns='columns'
      :rows='rows'
      row-key='id'
      :loading='firstLoad'
      clickable-rows
      min-width='720px'
      @row-click='openDetails'
    )
      template(#cell-date='{ row }')
        span.t-mono-sm {{ formatMoment(row.updated_at) }}
      template(#cell-participant='{ row }')
        .journal__name {{ row.displayName }}
        .journal__meta {{ row.subject || skipReasonLabel(row.reason) }}
      template(#cell-template='{ row }')
        div {{ row.template_title || '—' }}
        .journal__meta {{ kindLabel(row.kind) }}
      template(#cell-status='{ row }')
        BaseBadge(:variant='sendStatusView(row.status).variant') {{ sendStatusView(row.status).label }}
    TablePager.q-mt-md(
      v-if='pager.rowsNumber > pager.rowsPerPage'
      :page='pager.page'
      :rows-per-page='pager.rowsPerPage'
      :rows-number='pager.rowsNumber'
      @update:page='onPage'
    )

  DetailsDrawer(v-model='drawerOpen' :title='$t("greetings.journal.detailsTitle")')
    template(v-if='selected')
      .journal__drawer-name {{ selected.displayName }}
      BaseBadge.q-mb-md(:variant='sendStatusView(selected.status).variant') {{ sendStatusView(selected.status).label }}
      DataRow(:label='$t("greetings.journal.kind")' :value='kindLabel(selected.kind)' align='spread')
      DataRow(v-if='selected.occasion_date' :label='$t("greetings.journal.occasionDate")' :value='formatDay(selected.occasion_date)' align='spread')
      DataRow(v-else :label='$t("greetings.journal.year")' :value='selected.year' align='spread')
      DataRow(v-if='selected.subject' :label='$t("greetings.journal.subject")' :value='selected.subject' align='vertical')
      DataRow(v-if='selected.template_title' :label='$t("greetings.journal.template")' :value='selected.template_title' align='vertical')
      DataRow(v-if='selected.reason' :label='$t("greetings.journal.columnStatus")' :value='skipReasonLabel(selected.reason)' align='vertical')
      DataRow(v-if='selected.error' :label='$t("greetings.journal.error")' :value='selected.error' align='vertical')
      DataRow(:label='$t("greetings.journal.attempts")' :value='selected.attempts' align='spread')
      DataRow(:label='$t("greetings.journal.updatedAt")' :value='formatMoment(selected.updated_at)' align='spread')
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseBadge, BaseTable, EmptyState, TablePager, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import {
  GREETINGS_LIVE,
  formatDay,
  formatMoment,
  kindLabel,
  greetingsApi,
  sendStatusView,
  skipReasonLabel,
  type IGreetingSend,
} from '../../../entities/Greeting';
import { t } from '../../../i18n';

/**
 * Журнал писем: поздравление — одна запись на пайщика в год, рассылка —
 * одна запись на пайщика в её дату. Зоны строки: когда,
 * кому и с какой темой, по какому шаблону, итог. Строка открывает панель
 * со всеми фактами записи.
 */
const rows = ref<IGreetingSend[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const pager = reactive({ page: 1, rowsPerPage: 25, rowsNumber: 0 });

const columns: BaseTableColumn<IGreetingSend>[] = [
  { key: 'date', label: t('greetings.journal.columnDate'), width: '160px', nowrap: true },
  { key: 'participant', label: t('greetings.journal.columnParticipant') },
  { key: 'template', label: t('greetings.journal.columnTemplate'), width: '220px' },
  { key: 'status', label: t('greetings.journal.columnStatus'), width: '170px', nowrap: true },
];

async function load(silent = false) {
  try {
    const page = await greetingsApi.loadJournal({ page: pager.page, limit: pager.rowsPerPage, sortOrder: 'DESC' });
    rows.value = page.items;
    pager.rowsNumber = page.totalCount;
  } catch (error) {
    console.error(error);
    if (!silent) FailAlert(t('greetings.journal.loadError'));
  } finally {
    loading.value = false;
  }
}

function onPage(page: number) {
  pager.page = page;
  void load();
}

const drawerOpen = ref(false);
const selected = ref<IGreetingSend | null>(null);
function openDetails(row: IGreetingSend) {
  selected.value = row;
  drawerOpen.value = true;
}

onMounted(() => void load());
useLiveReload([GREETINGS_LIVE.sends], () => load(true));
</script>

<style scoped lang="scss">
.journal__name,
.journal__drawer-name {
  font-weight: 600;
  color: var(--p-ink);
}

.journal__drawer-name {
  font-size: var(--p-fs-h3);
  margin-bottom: var(--p-2);
}

.journal__meta {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
</style>
