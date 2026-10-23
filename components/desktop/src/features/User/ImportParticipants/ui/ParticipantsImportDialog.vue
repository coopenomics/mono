<template lang="pug">
q-dialog(v-model='show', maximized, @hide='onClose')
  q-card.import-wizard
    //- ===== Шапка =====
    header.import-wizard__bar
      .import-wizard__bar-title {{ $t('user.importDialog.title') }}
      q-btn(
        flat,
        round,
        dense,
        icon='close',
        :aria-label='$t("common.action.close")',
        @click='show = false'
      )

    //- ===== Тело =====
    .import-wizard__body
      .import-wizard__col
        p.import-wizard__intro
          | {{ $t('user.importDialog.introLine1') }}
          | {{ $t('user.importDialog.introLine2') }}
          | {{ $t('user.importDialog.introLine3') }}
          | {{ $t('user.importDialog.introLine4') }}

        //- ---------- Выбор типа ----------
        section.import-wizard__section(v-if='!selectedType')
          h3.import-wizard__section-title {{ $t('user.importDialog.typeSectionTitle') }}
          p.import-wizard__section-hint {{ $t('user.importDialog.typeSectionHint') }}
          .import-wizard__type-list
            BaseRadioCard(
              v-for='opt in typeCards',
              :key='opt.value',
              :model-value='selectedType ?? null',
              :value='opt.value',
              :title='opt.label',
              :description='opt.description',
              @update:model-value='selectedType = opt.value'
            )

        //- ---------- Выбранный тип + шаблон ----------
        section.import-wizard__section(v-if='selectedType')
          .import-wizard__type-bar
            .import-wizard__type-current
              q-icon(name='groups', size='18px')
              span {{ selectedTypeLabelFull }}
            q-space
            BaseButton(variant='ghost', size='sm', @click='downloadSample')
              q-icon(name='download', size='16px')
              span.q-ml-sm {{ $t('user.importDialog.downloadTemplate') }}
            BaseButton(variant='ghost', size='sm', @click='backToType')
              q-icon(name='undo', size='16px')
              span.q-ml-sm {{ $t('user.importDialog.changeType') }}

        //- ---------- Загрузка CSV ----------
        section.import-wizard__section(v-if='selectedType && !fileChosen')
          h3.import-wizard__section-title {{ $t('user.importDialog.uploadSectionTitle') }}
          p.import-wizard__section-hint {{ $t('user.importDialog.uploadSectionHint') }}
          .import-dropzone(
            :class='{ "import-dropzone--drag": isDragOver }',
            @dragover.prevent='onDrag',
            @dragleave.prevent='onLeave',
            @drop.prevent='onDrop',
            @click='fileInput?.click()'
          )
            q-icon(name='cloud_upload', size='36px')
            .import-dropzone__hint {{ $t('user.importDialog.dropzoneHint') }}
            .import-dropzone__file(v-if='selectedFile') {{ selectedFile.name }}
            .import-dropzone__file(v-else-if='fileName') {{ fileName }}
          input(
            ref='fileInput',
            type='file',
            accept='.csv',
            style='display:none',
            @change='onFileSelected'
          )
          .import-wizard__error(v-if='parseError') {{ parseError }}

        //- ---------- Предпросмотр ----------
        section.import-wizard__section(v-if='rows.length && !isImporting && !importResults.length')
          .import-wizard__section-head
            h3.import-wizard__section-title {{ $t('user.importDialog.previewTitle', { rowsCount: rows.length }) }}
            q-space
            .import-wizard__warn(v-if='hasErrors')
              q-icon(name='error', size='16px')
              span {{ $t('user.importDialog.hasErrorsWarning') }}

          q-table(
            :rows='rows',
            :columns='previewColumns',
            row-key='rowNumber',
            flat,
            dense,
            :pagination='{ rowsPerPage: 10 }'
          )
            template(#body-cell-data='props')
              q-td
                q-btn(flat dense round icon='more_horiz')
                  q-tooltip(max-width='320px')
                    div(v-for='item in detailsList(props.row)' :key='item.label')
                      strong {{ item.label }}:
                      span  {{ item.value }}
            template(#body-cell-status='props')
              q-td
                q-chip(
                  :color='getStatusColor(props.value)',
                  text-color='white',
                  dense,
                  :label='getStatusText(props.value)'
                )
            template(#body-cell-error='props')
              q-td
                span(v-if='props.value') {{ props.value }}
                span(v-else) -

        //- ---------- Запуск импорта ----------
        section.import-wizard__section(v-if='rows.length && (!importResults.length || isImporting)')
          .import-wizard__actions
            q-toggle(
              v-model='spreadInitial',
              color='primary',
              :label='$t("user.importDialog.spreadInitialLabel")'
            )
            q-space
            BaseButton(
              variant='primary',
              :disabled='!rows.length || hasErrors || isImporting',
              :loading='isImporting',
              @click='startImport'
            )
              q-icon(name='play_arrow', size='16px')
              span.q-ml-sm {{ $t('user.importDialog.startImport') }}
            BaseButton(
              v-if='isImporting',
              variant='danger',
              @click='stopImport'
            )
              q-icon(name='stop', size='16px')
              span.q-ml-sm {{ $t('user.importDialog.stopImport') }}

          .import-wizard__progress(v-if='isImporting')
            .import-wizard__progress-label {{ $t('user.importDialog.progressLabel', { current: importProgress, total: totalItems, percent: progressPercent }) }}
            q-linear-progress(
              :value='progressPercent / 100',
              color='primary',
              rounded,
              size='8px'
            )
            .import-wizard__progress-counts
              span.import-wizard__count
                q-icon(name='check_circle', color='positive', size='16px')
                | {{ $t('user.importDialog.successCountLabel', { successCount }) }}
              span.import-wizard__count
                q-icon(name='error', color='negative', size='16px')
                | {{ $t('user.importDialog.errorCountLabel', { errorCount }) }}

        //- ---------- Результаты ----------
        section.import-wizard__section(v-if='importResults.length || isImporting')
          .import-wizard__section-head
            h3.import-wizard__section-title {{ $t('user.importDialog.resultsTitle') }}
            q-space
            BaseButton(
              variant='ghost',
              size='sm',
              :disabled='!hasErrors',
              @click='retryFailed'
            )
              q-icon(name='refresh', size='16px')
              span.q-ml-sm {{ $t('user.importDialog.retryErrors') }}
            BaseButton(
              v-if='importResults.length',
              variant='ghost',
              size='sm',
              @click='downloadResults'
            )
              q-icon(name='file_download', size='16px')
              span.q-ml-sm {{ $t('user.importDialog.downloadResults') }}
            BaseButton(
              v-if='hasData',
              variant='ghost',
              size='sm',
              @click='clearAll'
            )
              q-icon(name='clear', size='16px')
              span.q-ml-sm {{ $t('user.importDialog.clear') }}

          q-table(
            :rows='importResults',
            :columns='resultColumns',
            row-key='rowNumber',
            dense,
            flat,
            :pagination='{ rowsPerPage: 10 }'
          )
            template(#body-cell-status='props')
              q-td
                q-chip(
                  :color='getStatusColor(props.value)',
                  text-color='white',
                  dense,
                  :label='getStatusText(props.value)'
                )
            template(#body-cell-actions='props')
              q-td
                q-btn(
                  v-if='props.row.status === "error"',
                  size='sm',
                  color='primary',
                  flat,
                  icon='refresh',
                  @click='retry(props.rowIndex)'
                )
            template(#body-cell-error='props')
              q-td
                span(v-if='props.value') {{ props.value }}
                span(v-else) -
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseRadioCard } from 'src/shared/ui/base/BaseRadioCard';
import { useParticipantCsvParser } from '../lib/useParticipantCsvParser';
import {
  type ParticipantType,
  useParticipantsBatchImport,
} from '../model';
import type { QTableProps } from 'quasar';
import { useCooperativeStore } from 'src/entities/Cooperative';
import { useSystemStore } from 'src/entities/System/model';
import { useAccountStore } from 'src/entities/Account/model';
import { FailAlert, SuccessAlert, NotifyAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const coop = useCooperativeStore();
const system = useSystemStore();
const accountStore = useAccountStore();

const selectedType = ref<ParticipantType | null>(null);
const selectedFile = ref<File | null>(null);
const parseError = ref<string>('');
const isDragOver = ref(false);
const fileInput = ref<HTMLInputElement>();
const spreadInitial = ref(true);
const fileChosen = ref(false);

const selectedTypeLabelFull = computed(() => {
  if (selectedType.value === 'individual') return t('user.importDialog.typeIndividualFull');
  if (selectedType.value === 'entrepreneur') return t('user.importDialog.typeEntrepreneurFull');
  if (selectedType.value === 'organization') return t('user.importDialog.typeOrganizationFull');
  return '';
});

const getDefaults = (type: ParticipantType) => {
  const symbol = coop.governSymbol || 'RUB';
  const data = coop.publicCooperativeData;
  if (!data) {
    return { initial: `0.0000 ${symbol}`, minimum: `0.0000 ${symbol}` };
  }

  if (type === 'organization') {
    return {
      initial: data.org_initial || data.initial,
      minimum: data.org_minimum || data.minimum,
    };
  }

  return { initial: data.initial, minimum: data.minimum };
};

const { rows, fileName, parseCsv, clear: clearParsed } = useParticipantCsvParser({
  coopSymbol: () => coop.governSymbol || 'RUB',
  getDefaults,
  quantity: () => ({
    precision: system.info?.symbols?.root_govern_precision ?? 4,
    symbol: system.info?.symbols?.root_govern_symbol ?? 'RUB',
  }),
});

const {
  importResults,
  isImporting,
  importProgress,
  successCount,
  errorCount,
  progressPercent,
  startBatchImport,
  retryImport,
  retryAllFailed,
  stopImport,
  resetImport,
} = useParticipantsBatchImport();

const hasData = computed(() => rows.value.length > 0 || importResults.value.length > 0);
const hasErrors = computed(
  () =>
    rows.value.some((row) => row.status === 'error') ||
    importResults.value.some((row) => row.status === 'error'),
);

const typeCards: { label: string; description: string; value: ParticipantType }[] = [
  { label: t('user.importDialog.typeIndividualFull'), description: t('user.importDialog.typeIndividualDescription'), value: 'individual' },
  {
    label: t('user.importDialog.typeEntrepreneurFull'),
    description: t('user.importDialog.typeEntrepreneurDescription'),
    value: 'entrepreneur',
  },
  {
    label: t('user.importDialog.typeOrganizationFull'),
    description: t('user.importDialog.typeOrganizationDescription'),
    value: 'organization',
  },
];

const detailsList = (row: any) => {
  const items: { label: string; value: any }[] = [];
  const push = (label: string, val?: any) => {
    if (val === undefined || val === null || val === '') return;
    items.push({ label, value: val });
  };
  push(t('user.importDialog.detail.joinDate'), row.created_at);
  push(t('user.importDialog.detail.initial'), row.initial);
  push(t('user.importDialog.detail.minimum'), row.minimum);
  push(t('user.importDialog.detail.referer'), row.referer);
  push(t('user.importDialog.detail.spreadInitial'), row.spread_initial ? t('user.importDialog.detail.yes') : t('user.importDialog.detail.no'));

  if (row.type === 'individual') {
    push(t('user.importDialog.detail.birthdate'), row.birthdate);
    push(t('user.importDialog.detail.address'), row.full_address);
    if (row.passport) {
      push(t('user.importDialog.detail.passportSeries'), row.passport.series);
      push(t('user.importDialog.detail.passportNumber'), row.passport.number);
      push(t('user.importDialog.detail.passportIssuedBy'), row.passport.issued_by);
      push(t('user.importDialog.detail.passportIssuedAt'), row.passport.issued_at);
      push(t('user.importDialog.detail.passportCode'), row.passport.code);
    }
  } else if (row.type === 'entrepreneur') {
    push(t('user.importDialog.detail.birthdate'), row.birthdate);
    push(t('user.importDialog.detail.country'), row.country);
    push(t('user.importDialog.detail.city'), row.city);
    push(t('user.importDialog.detail.address'), row.full_address);
    push(t('user.importDialog.detail.inn'), row.details?.inn);
    push(t('user.importDialog.detail.ogrn'), row.details?.ogrn);
    push(t('user.importDialog.detail.bank'), row.bank_account?.bank_name);
    push(t('user.importDialog.detail.accountNumber'), row.bank_account?.account_number);
    push(t('user.importDialog.detail.bik'), row.bank_account?.details?.bik);
    push(t('user.importDialog.detail.corrAccount'), row.bank_account?.details?.corr);
    push(t('user.importDialog.detail.currency'), row.bank_account?.currency);
  } else if (row.type === 'organization') {
    push(t('user.importDialog.detail.shortName'), row.short_name);
    push(t('user.importDialog.detail.fullName'), row.full_name);
    push(t('user.importDialog.detail.type'), row.org_type);
    push(t('user.importDialog.detail.country'), row.country);
    push(t('user.importDialog.detail.city'), row.city);
    push(t('user.importDialog.detail.legalAddress'), row.full_address);
    push(t('user.importDialog.detail.factAddress'), row.fact_address);
    push(t('user.importDialog.detail.inn'), row.details?.inn);
    push(t('user.importDialog.detail.ogrn'), row.details?.ogrn);
    push(t('user.importDialog.detail.kpp'), row.details?.kpp);
    if (row.represented_by) {
      push(
        t('user.importDialog.detail.representative'),
        `${row.represented_by.last_name} ${row.represented_by.first_name} ${row.represented_by.middle_name ?? ''}`.trim(),
      );
      push(t('user.importDialog.detail.position'), row.represented_by.position);
      push(t('user.importDialog.detail.basis'), row.represented_by.based_on);
    }
    push(t('user.importDialog.detail.bank'), row.bank_account?.bank_name);
    push(t('user.importDialog.detail.accountNumber'), row.bank_account?.account_number);
    push(t('user.importDialog.detail.bik'), row.bank_account?.details?.bik);
    push(t('user.importDialog.detail.corrAccount'), row.bank_account?.details?.corr);
    push(t('user.importDialog.detail.currency'), row.bank_account?.currency);
  }

  return items;
};

const previewColumns: QTableProps['columns'] = [
  { name: 'rowNumber', label: '№', field: 'rowNumber', align: 'left' },
  { name: 'type', label: t('user.importDialog.column.type'), field: (row) => row.displayType || row.type, align: 'left' },
  { name: 'displayName', label: t('user.importDialog.column.name'), field: 'displayName', align: 'left' },
  { name: 'email', label: t('user.importDialog.column.email'), field: 'email', align: 'left' },
  { name: 'phone', label: t('user.importDialog.column.phone'), field: 'phone', align: 'left' },
  { name: 'data', label: t('user.importDialog.column.data'), field: 'data', align: 'center' },
  { name: 'status', label: t('user.importDialog.column.status'), field: 'status', align: 'center' },
  { name: 'error', label: t('user.importDialog.column.error'), field: 'error', align: 'left' },
];

const resultColumns: QTableProps['columns'] = [
  ...previewColumns,
  { name: 'actions', label: t('user.importDialog.column.actions'), field: 'actions', align: 'center' },
];

const totalItems = computed(
  () => importResults.value.length || rows.value.length,
);

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'pending':
      return 'grey-6';
    case 'success':
      return 'positive';
    case 'error':
      return 'negative';
    default:
      return 'grey';
  }
};

const getStatusText = (status?: string) => {
  switch (status) {
    case 'pending':
      return t('user.importDialog.status.pending');
    case 'success':
      return t('user.importDialog.status.success');
    case 'error':
      return t('user.importDialog.status.error');
    default:
      return '—';
  }
};

const ensureCoopData = async () => {
  if (!coop.publicCooperativeData) {
    try {
      await coop.loadPublicCooperativeData(system.info.coopname);
    } catch {
      FailAlert(t('user.importDialog.loadCoopDataError'));
    }
  }
};

onMounted(async () => {
  await ensureCoopData();
});

watch(selectedType, () => {
  parseError.value = '';
  selectedFile.value = null;
  fileChosen.value = false;
  clearParsed();
  resetImport();
});

const onFileSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files?.length || !selectedType.value) return;
  await handleFile(target.files[0]);
};

const handleFile = async (file: File) => {
  if (!selectedType.value) {
    parseError.value = t('user.importDialog.selectTypeError');
    return;
  }
  parseError.value = '';
  selectedFile.value = file;

  try {
    await ensureCoopData();
    await parseCsv(file, selectedType.value);
    fileChosen.value = true;
    resetImport();
    NotifyAlert(t('user.importDialog.fileParsedNotice', { rowsCount: rows.value.length }));
  } catch (e: any) {
    parseError.value = e?.message ?? t('user.importDialog.parseFileError');
    FailAlert(parseError.value);
  }
};

const onDrop = async (event: DragEvent) => {
  isDragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) await handleFile(file);
};

const onDrag = () => {
  isDragOver.value = true;
};

const onLeave = () => {
  isDragOver.value = false;
};

const startImport = async () => {
  if (!rows.value.length) {
    NotifyAlert(t('user.importDialog.noDataError'));
    return;
  }

  const prepared = rows.value.map((row) => ({
    ...row,
    input: row.input
      ? { ...row.input, spread_initial: spreadInitial.value }
      : row.input,
  }));

  await startBatchImport(prepared, { spreadInitial: spreadInitial.value });

  if (errorCount.value === 0) {
    SuccessAlert(t('user.importDialog.importDoneAllSuccess', { successCount: successCount.value }));
  } else {
    NotifyAlert(
      t('user.importDialog.importDoneMixed', { successCount: successCount.value, errorCount: errorCount.value }),
    );
  }

  try {
    await accountStore.getAccounts({
      options: { page: 1, limit: 1000, sortOrder: 'DESC' },
    });
  } catch {
    // ignore refresh errors
  }
};

const retry = async (index: number) => {
  await retryImport(index);
};

const retryFailed = async () => {
  await retryAllFailed();
};

const clearAll = () => {
  clearParsed();
  resetImport();
  selectedFile.value = null;
  parseError.value = '';
  fileChosen.value = false;
  selectedType.value = null;
};

const backToType = () => {
  clearAll();
};

const onClose = () => {
  clearAll();
};

const downloadBlob = (content: string, name: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};

const sampleTemplates = computed(() => {
  const defaultsIndividual = getDefaults('individual');
  const defaultsOrg = getDefaults('organization');

  return {
    individual: [
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      '№,фамилия,имя,отчество,почта,телефон,дата рождения,адрес,вступительный взнос,минимальный взнос,дата вступления,реферер,паспорт серия,паспорт номер,кем выдан,когда выдан,код подразделения',
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      `1,Иванов,Иван,Иванович,ivan@example.com,+7 999 111-22-33,1990-01-01,"г. Москва, ул. Ленина, д.1",${defaultsIndividual.initial},${defaultsIndividual.minimum},2024-01-10,,4000,123456,ОВД Москвы,2010-05-01,770-000`,
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      `2,Петров,Петр,Петрович,petrov@example.com,+7 999 444-55-66,1985-02-02,"г. Казань, ул. Баумана, д.5",${defaultsIndividual.initial},${defaultsIndividual.minimum},2024-01-12,,,,,`,
    ].join('\n'),
    entrepreneur: [
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      '№,фамилия,имя,отчество,почта,телефон,дата рождения,страна,город,адрес,инн,огрн,банк,расчетный счет,бик,корр счет,валюта,вступительный взнос,минимальный взнос,дата вступления',
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      `1,Смирнов,Алексей,Сергеевич,smirnov@example.com,+7 912 000-11-22,1988-03-03,Russia,Екатеринбург,"ул. Мира, 10",123456789012,1234567890123,"АО Банк",40817810099910004312,044525225,30101810400000000225,RUB,${defaultsIndividual.initial},${defaultsIndividual.minimum},2024-02-01`,
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      `2,Кузнецов,Дмитрий,Олегович,dmitry@example.com,+7 921 555-66-77,1991-04-04,Russia,Самара,"ул. Гагарина, 22",9876543210,9876543210987,"ПАО Банк",40817810099910004313,044525226,30101810400000000226,RUB,${defaultsIndividual.initial},${defaultsIndividual.minimum},2024-02-05`,
    ].join('\n'),
    organization: [
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      '№,краткое название,полное название,тип,почта,телефон,страна,город,юрадрес,фактический адрес,инн,огрн,кпп,представитель фамилия,представитель имя,представитель отчество,должность представителя,основание полномочий,банк,расчетный счет,бик,корр счет,валюта,вступительный взнос,минимальный взнос,дата вступления',
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      `1,"ООО Ромашка","Общество с ограниченной ответственностью Ромашка",COOP,office@example.com,+7 495 000-11-22,Russia,Москва,"ул. Тверская, 1","ул. Тверская, 1",7701234567,1234567890123,770101001,Сидоров,Виктор,Алексеевич,Генеральный директор,Устав,"АО Банк",40702810999910004312,044525225,30101810400000000225,RUB,${defaultsOrg.initial},${defaultsOrg.minimum},2024-03-01`,
      // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
      `2,"АНО Прогресс","Автономная некоммерческая организация Прогресс",COOP,contact@progress.ru,+7 812 333-44-55,Russia,Санкт-Петербург,"Невский пр., 10","Невский пр., 10",7801234567,9876543210987,780101001,Ильина,Мария,Игоревна,Директор,Устав,"ПАО Банк",40702810999910004313,044525226,30101810400000000226,RUB,${defaultsOrg.initial},${defaultsOrg.minimum},2024-03-05`,
    ].join('\n'),
  };
});

const downloadSample = () => {
  if (!selectedType.value) return;
  const template = sampleTemplates.value[selectedType.value];
  downloadBlob(template, `sample-${selectedType.value}.csv`);
};

const downloadResults = () => {
  const data = importResults.value.length ? importResults.value : rows.value;
  if (!data.length) return;

  const lines = [
    // i18n-ignore: CSV-шаблон — данные, не текст интерфейса
    '№,тип,имя/название,почта,телефон,статус,ошибка',
    ...data.map(
      (row) =>
        `${row.rowNumber},${row.type},${row.displayName ?? ''},${row.email},${row.phone ?? ''},${row.status ?? ''},"${row.error ?? ''}"`,
    ),
  ];

  downloadBlob(lines.join('\n'), 'import-results.csv');
};

</script>

<style scoped lang="scss">
.import-wizard {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--p-canvas);
}

/* ===== Шапка ===== */
.import-wizard__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border-bottom: 1px solid var(--p-line);
  flex-shrink: 0;
}
.import-wizard__bar-title {
  font-size: var(--p-fs-h2, 18px);
  font-weight: 600;
  color: var(--p-ink);
}

/* ===== Тело ===== */
.import-wizard__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: var(--p-6, 24px) var(--p-4, 16px);
}
.import-wizard__col {
  max-width: 880px;
  margin: 0 auto;
}
.import-wizard__intro {
  margin: 0 0 var(--p-5, 20px);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.55;
  color: var(--p-ink-2);
}

/* ===== Секции ===== */
.import-wizard__section {
  margin-bottom: var(--p-5, 20px);
}
.import-wizard__section-head {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  margin-bottom: var(--p-3, 12px);
}
.import-wizard__section-title {
  margin: 0 0 var(--p-1, 4px);
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
}
.import-wizard__section-hint {
  margin: 0 0 var(--p-3, 12px);
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
}
.import-wizard__type-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

/* Текущий выбранный тип + действия с шаблоном */
.import-wizard__type-bar {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.import-wizard__type-current {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  color: var(--p-ink);
}

/* Зона загрузки CSV */
.import-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: var(--p-6, 24px);
  text-align: center;
  color: var(--p-primary);
  border: 1px dashed var(--p-line-2, var(--p-line));
  border-radius: var(--p-r-md, 12px);
  background: var(--p-surface);
  cursor: pointer;
  transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard),
    background-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.import-dropzone:hover,
.import-dropzone--drag {
  border-color: var(--p-primary);
  background: var(--p-primary-soft);
}
.import-dropzone__hint {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
}
.import-dropzone__file {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink);
  font-weight: 600;
}

.import-wizard__error {
  margin-top: var(--p-3, 12px);
  padding: var(--p-2, 8px) var(--p-3, 12px);
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-neg);
  background: var(--p-neg-soft);
  border-radius: var(--p-r-sm, 8px);
}

.import-wizard__warn {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-warn);
}

/* Действия импорта */
.import-wizard__actions {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  margin-bottom: var(--p-3, 12px);
}
.import-wizard__progress {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
.import-wizard__progress-label {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
}
.import-wizard__progress-counts {
  display: flex;
  gap: var(--p-4, 16px);
}
.import-wizard__count {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-1);
}
</style>
