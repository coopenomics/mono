<template lang="pug">
q-dialog(v-model='show', maximized, @hide='onClose')
  ModalBase(title='Импорт пайщиков')
    .q-pa-md
      q-card(flat class='q-mb-md' v-if='!selectedType')
        q-card-section
          .text-subtitle1.q-mb-sm Тип аккаунтов
          q-option-group(
            v-model='selectedType',
            :options='typeOptions',
            :inline='false',
            :dense='false',
            size='lg'
          )

      q-card(flat class='q-mb-md' v-if='selectedType')
        q-card-section
          .row.items-center.q-gutter-sm
            q-chip(color='primary', text-color='white') {{ selectedTypeLabelFull }}
            q-space
            q-btn(flat color='primary' icon='download' @click='downloadSample') Скачать шаблон CSV
            q-btn(flat color='grey-7' icon='undo' @click='backToType') Назад

      q-card(flat class='q-mb-md' v-if='selectedType && !fileChosen')
        q-card-section
          .text-subtitle1.q-mb-sm Загрузка CSV
          .upload-area(
            :class='{ "upload-area--drag": isDragOver }',
            @dragover.prevent='onDrag',
            @dragleave.prevent='onLeave',
            @drop.prevent='onDrop'
          )
            q-icon(name='cloud_upload', size='36px', color='primary')
            div.q-mt-sm Перетащите или выберите CSV
            .text-caption(v-if='selectedFile') {{ selectedFile.name }}
            .text-caption(v-else-if='fileName') {{ fileName }}
            q-btn.q-mt-sm(
              color='primary',
              flat,
              size='sm',
              @click='fileInput?.click()'
            ) Выбрать файл
          input(
            ref='fileInput',
            type='file',
            accept='.csv',
            style='display:none',
            @change='onFileSelected'
          )
          q-banner(
            v-if='parseError',
            class='q-mt-md',
            type='negative',
            rounded,
            dense
          ) {{ parseError }}

      q-separator

      q-card-section(v-if='rows.length && !isImporting && !importResults.length')
        .row.items-center.q-gutter-sm.q-mb-sm
          q-icon(name='table_chart', size='20px')
          .text-subtitle1 Предварительный просмотр ({{ rows.length }})
          q-space
          q-chip(
            v-if='hasErrors',
            color='warning',
            text-color='white',
            dense,
            icon='error'
          ) Есть строки с ошибками

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

      q-card(flat class='q-mb-md' v-if='rows.length && (!importResults.length || isImporting)')
        q-card-section
          .row.items-center.q-gutter-sm.q-mb-sm
            q-space
            q-toggle(
              v-model='spreadInitial',
              color='primary',
              label='Начислить вступительный взнос в кошелек'
            )
            q-btn(
              color='primary',
              :disable='!rows.length || hasErrors || isImporting',
              :loading='isImporting',
              icon='play_arrow',
              label='Импортировать',
              @click='startImport'
            )
            q-btn(
              color='negative',
              flat,
              v-if='isImporting',
              icon='stop',
              label='Остановить',
              @click='stopImport'
            )

          .q-mt-sm(v-if='isImporting')
            .text-caption.q-mb-xs Прогресс: {{ importProgress }}/{{ totalItems }} ({{ progressPercent }}%)
            q-linear-progress(
              :value='progressPercent / 100',
              color='primary',
              rounded,
              size='8px'
            )
            .row.q-gutter-md.q-mt-sm
              .col-auto.text-body2
                q-icon(name='check_circle', color='positive', size='18px').q-mr-xs
                | Успешно: {{ successCount }}
              .col-auto.text-body2
                q-icon(name='error', color='negative', size='18px').q-mr-xs
                | Ошибок: {{ errorCount }}

      q-card(flat v-if='importResults.length || isImporting')
        q-card-section
          .row.items-center.q-gutter-sm.q-mb-sm
            q-icon(name='fact_check', size='20px')
            .text-subtitle1 Результаты импорта
            q-space
            q-btn(
              color='primary',
              flat,
              icon='refresh',
              :disable='!hasErrors',
              @click='retryFailed'
            ) Повторить ошибки
            q-btn(
              v-if='importResults.length'
              color='secondary',
              flat,
              icon='file_download',
              @click='downloadResults'
            ) Скачать результаты
            q-btn(
              v-if='hasData',
              color='grey-7',
              flat,
              icon='clear',
              @click='clearAll'
            ) Очистить

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
import { ModalBase } from 'src/shared/ui/ModalBase';
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
  if (selectedType.value === 'individual') return 'Физические лица';
  if (selectedType.value === 'entrepreneur') return 'Индивидуальные предприниматели';
  if (selectedType.value === 'organization') return 'Юридические лица';
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

const typeOptions: { label: string; value: ParticipantType }[] = [
  { label: 'Физические лица', value: 'individual' },
  { label: 'Индивидуальные предприниматели', value: 'entrepreneur' },
  { label: 'Юридические лица', value: 'organization' },
];

const detailsList = (row: any) => {
  const items: { label: string; value: any }[] = [];
  const push = (label: string, val?: any) => {
    if (val === undefined || val === null || val === '') return;
    items.push({ label, value: val });
  };
  push('Дата вступления', row.created_at);
  push('Вступительный', row.initial);
  push('Минимальный', row.minimum);
  push('Реферер', row.referer);
  push('Взнос в кошелек', row.spread_initial ? 'да' : 'нет');

  if (row.type === 'individual') {
    push('Дата рождения', row.birthdate);
    push('Адрес', row.full_address);
    if (row.passport) {
      push('Паспорт серия', row.passport.series);
      push('Паспорт номер', row.passport.number);
      push('Кем выдан', row.passport.issued_by);
      push('Когда выдан', row.passport.issued_at);
      push('Код подразделения', row.passport.code);
    }
  } else if (row.type === 'entrepreneur') {
    push('Дата рождения', row.birthdate);
    push('Страна', row.country);
    push('Город', row.city);
    push('Адрес', row.full_address);
    push('ИНН', row.details?.inn);
    push('ОГРН', row.details?.ogrn);
    push('Банк', row.bank_account?.bank_name);
    push('Р/с', row.bank_account?.account_number);
    push('БИК', row.bank_account?.details?.bik);
    push('КПП банка', row.bank_account?.details?.kpp);
    push('Корр. счет', row.bank_account?.details?.corr);
    push('Валюта', row.bank_account?.currency);
  } else if (row.type === 'organization') {
    push('Краткое название', row.short_name);
    push('Полное название', row.full_name);
    push('Тип', row.org_type);
    push('Страна', row.country);
    push('Город', row.city);
    push('Юр. адрес', row.full_address);
    push('Факт. адрес', row.fact_address);
    push('ИНН', row.details?.inn);
    push('ОГРН', row.details?.ogrn);
    push('КПП', row.details?.kpp);
    if (row.represented_by) {
      push(
        'Представитель',
        `${row.represented_by.last_name} ${row.represented_by.first_name} ${row.represented_by.middle_name ?? ''}`.trim(),
      );
      push('Должность', row.represented_by.position);
      push('Основание', row.represented_by.based_on);
    }
    push('Банк', row.bank_account?.bank_name);
    push('Р/с', row.bank_account?.account_number);
    push('БИК', row.bank_account?.details?.bik);
    push('КПП банка', row.bank_account?.details?.kpp);
    push('Корр. счет', row.bank_account?.details?.corr);
    push('Валюта', row.bank_account?.currency);
  }

  return items;
};

const previewColumns: QTableProps['columns'] = [
  { name: 'rowNumber', label: '№', field: 'rowNumber', align: 'left' },
  { name: 'type', label: 'Тип', field: (row) => row.displayType || row.type, align: 'left' },
  { name: 'displayName', label: 'Имя/Название', field: 'displayName', align: 'left' },
  { name: 'email', label: 'Почта', field: 'email', align: 'left' },
  { name: 'phone', label: 'Телефон', field: 'phone', align: 'left' },
  { name: 'data', label: 'Данные', field: 'data', align: 'center' },
  { name: 'status', label: 'Статус', field: 'status', align: 'center' },
  { name: 'error', label: 'Ошибка', field: 'error', align: 'left' },
];

const resultColumns: QTableProps['columns'] = [
  ...previewColumns,
  { name: 'actions', label: 'Действия', field: 'actions', align: 'center' },
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
      return 'Ожидает';
    case 'success':
      return 'Успешно';
    case 'error':
      return 'Ошибка';
    default:
      return '—';
  }
};

const ensureCoopData = async () => {
  if (!coop.publicCooperativeData) {
    try {
      await coop.loadPublicCooperativeData(system.info.coopname);
    } catch {
      FailAlert('Не удалось загрузить данные кооператива');
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
    parseError.value = 'Выберите тип аккаунта';
    return;
  }
  parseError.value = '';
  selectedFile.value = file;

  try {
    await ensureCoopData();
    await parseCsv(file, selectedType.value);
    fileChosen.value = true;
    resetImport();
    NotifyAlert(`Файл разобран. Записей: ${rows.value.length}`);
  } catch (e: any) {
    parseError.value = e?.message ?? 'Ошибка при разборе файла';
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
    NotifyAlert('Нет данных для импорта');
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
    SuccessAlert(`Импорт завершен: ${successCount.value}`);
  } else {
    NotifyAlert(
      `Импорт завершен. Успешно: ${successCount.value}, Ошибок: ${errorCount.value}`,
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
      '№,фамилия,имя,отчество,почта,телефон,дата рождения,адрес,вступительный взнос,минимальный взнос,дата вступления,реферер,паспорт серия,паспорт номер,кем выдан,когда выдан,код подразделения',
      `1,Иванов,Иван,Иванович,ivan@example.com,+7 999 111-22-33,1990-01-01,"г. Москва, ул. Ленина, д.1",${defaultsIndividual.initial},${defaultsIndividual.minimum},2024-01-10,,4000,123456,ОВД Москвы,2010-05-01,770-000`,
      `2,Петров,Петр,Петрович,petrov@example.com,+7 999 444-55-66,1985-02-02,"г. Казань, ул. Баумана, д.5",${defaultsIndividual.initial},${defaultsIndividual.minimum},2024-01-12,,,,,`,
    ].join('\n'),
    entrepreneur: [
      '№,фамилия,имя,отчество,почта,телефон,дата рождения,страна,город,адрес,инн,огрн,банк,расчетный счет,бик,кпп банка,корр счет,валюта,вступительный взнос,минимальный взнос,дата вступления',
      `1,Смирнов,Алексей,Сергеевич,smirnov@example.com,+7 912 000-11-22,1988-03-03,Russia,Екатеринбург,"ул. Мира, 10",123456789012,1234567890123,"АО Банк",40817810099910004312,044525225,773643001,30101810400000000225,RUB,${defaultsIndividual.initial},${defaultsIndividual.minimum},2024-02-01`,
      `2,Кузнецов,Дмитрий,Олегович,dmitry@example.com,+7 921 555-66-77,1991-04-04,Russia,Самара,"ул. Гагарина, 22",9876543210,9876543210987,"ПАО Банк",40817810099910004313,044525226,773643002,30101810400000000226,RUB,${defaultsIndividual.initial},${defaultsIndividual.minimum},2024-02-05`,
    ].join('\n'),
    organization: [
      '№,краткое название,полное название,тип,почта,телефон,страна,город,юрадрес,фактический адрес,инн,огрн,кпп,представитель фамилия,представитель имя,представитель отчество,должность представителя,основание полномочий,банк,расчетный счет,бик,кпп банка,корр счет,валюта,вступительный взнос,минимальный взнос,дата вступления',
      `1,"ООО Ромашка","Общество с ограниченной ответственностью Ромашка",COOP,office@example.com,+7 495 000-11-22,Russia,Москва,"ул. Тверская, 1","ул. Тверская, 1",7701234567,1234567890123,770101001,Сидоров,Виктор,Алексеевич,Генеральный директор,Устав,"АО Банк",40702810999910004312,044525225,773643001,30101810400000000225,RUB,${defaultsOrg.initial},${defaultsOrg.minimum},2024-03-01`,
      `2,"АНО Прогресс","Автономная некоммерческая организация Прогресс",COOP,contact@progress.ru,+7 812 333-44-55,Russia,Санкт-Петербург,"Невский пр., 10","Невский пр., 10",7801234567,9876543210987,780101001,Ильина,Мария,Игоревна,Директор,Устав,"ПАО Банк",40702810999910004313,044525226,773643002,30101810400000000226,RUB,${defaultsOrg.initial},${defaultsOrg.minimum},2024-03-05`,
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
.upload-area {
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  transition: border-color 0.2s ease;
  cursor: pointer;

  &--drag {
    border-color: #1976d2;
  }
}
</style>
