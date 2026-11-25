<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key='greetings:calendar:hint' variant='info' icon='event')
    | {{ $t('greetings.calendar.hint') }}

  .calendar__nav.q-mb-md
    BaseButton(variant='secondary' size='sm' icon-only :aria-label='$t("greetings.calendar.previous")' @click='shift(-1)')
      template(#icon-left)
        q-icon(name='chevron_left')
    .calendar__month {{ monthTitle }}
    BaseButton(variant='secondary' size='sm' icon-only :aria-label='$t("greetings.calendar.next")' @click='shift(1)')
      template(#icon-left)
        q-icon(name='chevron_right')

  //- Рассылки месяца: дата, тема, состояние и счётчик писем; строка открывает панель рассылки.
  template(v-if='mailings.length')
    .calendar__section {{ $t('greetings.calendar.mailingsTitle') }}
    BaseTable.q-mb-lg(
      :columns='mailingColumns'
      :rows='mailings'
      :row-key='mailingKey'
      clickable-rows
      min-width='720px'
      @row-click='openMailing'
    )
      template(#cell-date='{ row }')
        span.t-mono-sm {{ formatDay(row.date, false) }}
      template(#cell-mailing='{ row }')
        .calendar__name {{ row.title }}
        .calendar__meta {{ row.repeat_yearly ? kindLabel(Zeus.GreetingTemplateKind.MAILING, true) : row.subject }}
      template(#cell-letters='{ row }')
        span {{ lettersLabel(row) }}
      template(#cell-status='{ row }')
        BaseBadge(:variant='mailingStateView(row).variant') {{ mailingStateView(row).label }}

  .calendar__section(v-if='mailings.length') {{ $t('greetings.calendar.birthdaysTitle') }}
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

  DetailsDrawer(v-model='mailingOpen' :title='$t("greetings.calendar.mailingDetailsTitle")')
    template(v-if='selectedMailing')
      .calendar__drawer-name {{ selectedMailing.title }}
      BaseBadge.q-mb-md(:variant='mailingStateView(selectedMailing).variant') {{ mailingStateView(selectedMailing).label }}
      DataRow(:label='$t("greetings.journal.occasionDate")' :value='formatDay(selectedMailing.date)' align='spread')
      DataRow(:label='$t("greetings.journal.subject")' :value='selectedMailing.subject' align='vertical')
      DataRow(:label='$t("greetings.calendar.sent")' :value='selectedMailing.sent' align='spread')
      DataRow(:label='$t("greetings.calendar.failed")' :value='selectedMailing.failed' align='spread')
      .calendar__meta.q-mt-md {{ $t('greetings.calendar.deliveryNote') }}
    template(#footer)
      BaseButton(v-if='selectedMailing' variant='secondary' size='sm' @click='openTemplate(selectedMailing.template_id)')
        | {{ $t('greetings.calendar.openTemplate') }}

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
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
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
  kindLabel,
  mailingStateView,
  sendStatusView,
  type IGreetingCalendarEntry,
  type IGreetingMailing,
} from '../../../entities/Greeting';
import { t } from '../../../i18n';

/**
 * Календарь месяца: рассылки (дата, тема, писем отправлено, состояние) и
 * дни рождения (дата, пайщик, возраст, шаблон, итог поздравления).
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

const mailings = ref<IGreetingMailing[]>([]);
const mailingColumns: BaseTableColumn<IGreetingMailing>[] = [
  { key: 'date', label: t('greetings.calendar.columnDate'), width: '90px', nowrap: true },
  { key: 'mailing', label: t('greetings.calendar.columnMailing') },
  { key: 'letters', label: t('greetings.calendar.columnLetters'), width: '220px', nowrap: true },
  { key: 'status', label: t('greetings.calendar.columnStatus'), width: '170px', nowrap: true },
];
const mailingKey = (row: IGreetingMailing) => `${row.template_id}:${row.date}`;
const lettersLabel = (row: IGreetingMailing) =>
  row.failed
    ? t('greetings.calendar.lettersFailed', { sent: row.sent, failed: row.failed })
    : t('greetings.calendar.letters', { sent: row.sent });

const mailingOpen = ref(false);
const selectedMailing = ref<IGreetingMailing | null>(null);
function openMailing(row: IGreetingMailing) {
  selectedMailing.value = row;
  mailingOpen.value = true;
}

const route = useRoute();
const router = useRouter();
function openTemplate(id: string) {
  void router.push({ name: 'greetings-template', params: { coopname: route.params.coopname, id } });
}

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    const [birthdays, monthMailings] = await Promise.all([
      greetingsApi.loadCalendar(year.value, month.value),
      greetingsApi.loadMailings(year.value, month.value),
    ]);
    rows.value = birthdays;
    mailings.value = monthMailings;
    // Открытая панель рассылки получает свежие счётчики по сигналу журнала.
    if (selectedMailing.value) {
      const key = mailingKey(selectedMailing.value);
      selectedMailing.value = monthMailings.find((item) => mailingKey(item) === key) ?? selectedMailing.value;
    }
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
.calendar__section {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  margin-bottom: var(--p-2);
}

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
