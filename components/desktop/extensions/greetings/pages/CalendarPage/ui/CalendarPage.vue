<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key='greetings:calendar:hint' variant='info' icon='event')
    | {{ $t('greetings.calendar.hint') }}

  .calendar__nav.q-mb-md
    BaseButton(variant='secondary' size='sm' icon-only :aria-label='$t("greetings.calendar.previous")' @click='shift(-1)')
      q-icon(name='chevron_left')
    .calendar__month {{ monthTitle }}
    BaseButton(variant='secondary' size='sm' icon-only :aria-label='$t("greetings.calendar.next")' @click='shift(1)')
      q-icon(name='chevron_right')

  EmptyState(
    v-if='!firstLoad && !loading && !rows.length'
    :title='$t("greetings.calendar.emptyTitle")'
    :body='$t("greetings.calendar.emptyBody")'
  )
    template(#icon)
      q-icon(name='event' size='32px')

  BaseTable(
    v-else
    :columns='columns'
    :rows='rows'
    row-key='username'
    :loading='firstLoad'
    clickable-rows
    min-width='720px'
    @row-click='openDetails'
  )
    template(#cell-date='{ row }')
      span.t-mono-sm {{ formatDay(row.date, false) }}
    template(#cell-participant='{ row }')
      .calendar__name {{ row.displayName }}
      .calendar__meta {{ accountTypeLabel(row.account_type) }}
    template(#cell-age='{ row }')
      span {{ ageLabel(row.age) }}
    template(#cell-template='{ row }')
      span(:class='{ "calendar__muted": !row.template_title }') {{ row.template_title || $t('greetings.calendar.noTemplate') }}
    template(#cell-status='{ row }')
      BaseBadge(v-if='row.send_status' :variant='sendStatusView(row.send_status).variant') {{ sendStatusView(row.send_status).label }}
      span.calendar__muted(v-else) {{ $t('greetings.calendar.notYet') }}

  DetailsDrawer(v-model='drawerOpen' :title='$t("greetings.calendar.detailsTitle")')
    template(v-if='selected')
      .calendar__drawer-name {{ selected.displayName }}
      DataRow(:label='$t("greetings.calendar.columnDate")' :value='formatDay(selected.date)' align='spread')
      DataRow(:label='$t("greetings.calendar.columnAge")' :value='ageLabel(selected.age)' align='spread')
      DataRow(:label='$t("greetings.calendar.accountType")' :value='accountTypeLabel(selected.account_type)' align='vertical')
      DataRow(:label='$t("greetings.calendar.columnTemplate")' :value='selected.template_title || $t("greetings.calendar.noTemplate")' align='vertical')
      DataRow(
        :label='$t("greetings.calendar.columnStatus")'
        :value='selected.send_status ? sendStatusView(selected.send_status).label : $t("greetings.calendar.notYet")'
        align='spread'
      )
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { uiLocale } from 'src/shared/i18n';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseBadge, BaseButton, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import {
  GREETINGS_LIVE,
  accountTypeLabel,
  formatDay,
  greetingsApi,
  sendStatusView,
  type IGreetingCalendarEntry,
} from '../../../entities/Greeting';
import { t } from '../../../i18n';

/**
 * Календарь дней рождения по месяцам. Зоны строки: дата, пайщик, возраст,
 * шаблон на эту дату, итог поздравления в году календаря.
 */
const now = new Date();
const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1);
const rows = ref<IGreetingCalendarEntry[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

const monthTitle = computed(() => {
  const label = new Intl.DateTimeFormat(uiLocale(), { month: 'long', year: 'numeric' }).format(
    new Date(year.value, month.value - 1, 1),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
});

const ageLabel = (age: number) => t('greetings.calendar.age', age);

const columns: BaseTableColumn<IGreetingCalendarEntry>[] = [
  { key: 'date', label: t('greetings.calendar.columnDate'), width: '90px', nowrap: true },
  { key: 'participant', label: t('greetings.calendar.columnParticipant') },
  { key: 'age', label: t('greetings.calendar.columnAge'), width: '120px', nowrap: true },
  { key: 'template', label: t('greetings.calendar.columnTemplate'), width: '220px' },
  { key: 'status', label: t('greetings.calendar.columnStatus'), width: '170px', nowrap: true },
];

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    rows.value = await greetingsApi.loadCalendar(year.value, month.value);
  } catch (error) {
    console.error(error);
    if (!silent) FailAlert(t('greetings.calendar.loadError'));
  } finally {
    loading.value = false;
  }
}

function shift(delta: number) {
  const next = new Date(year.value, month.value - 1 + delta, 1);
  year.value = next.getFullYear();
  month.value = next.getMonth() + 1;
  void load();
}

const drawerOpen = ref(false);
const selected = ref<IGreetingCalendarEntry | null>(null);
function openDetails(row: IGreetingCalendarEntry) {
  selected.value = row;
  drawerOpen.value = true;
}

onMounted(() => void load());
useLiveReload([GREETINGS_LIVE.calendar, GREETINGS_LIVE.sends, GREETINGS_LIVE.templates], () => load(true));
</script>

<style scoped lang="scss">
.calendar__nav {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.calendar__month {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  min-width: calc(var(--p-10) * 3);
  text-align: center;
}

.calendar__name,
.calendar__drawer-name {
  font-weight: 600;
  color: var(--p-ink);
}

.calendar__drawer-name {
  font-size: var(--p-fs-h3);
  margin-bottom: var(--p-3);
}

.calendar__meta,
.calendar__muted {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
</style>
