import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { encode as encodeCp1251 } from 'windows-1251';
import { reportApi } from '../api';
import type {
  IAvailableReport,
  IBuildInitialReportEdits,
  IFieldError,
  IGeneratedReport,
  IMarkReportPeriodInput,
  IReportCalendarRow,
  IReportDraft,
  IReportHistoryFilterInput,
  IReportHistoryPage,
  IReportReadinessView,
  IReportRequisitesView,
  IReportType,
  ISaveReportDraftInput,
  IUpdateReportRequisitesInput,
} from '../types';

const namespace = 'report';

export const useReportStore = defineStore(namespace, () => {
  const reports = ref<IAvailableReport[]>([]);
  const loading = ref(false);

  const archive = reactive<{ items: IReportHistoryPage['items']; total: number }>({
    items: [],
    total: 0,
  });
  const archiveLoading = ref(false);

  // Sequence-guard: быстрая навигация/смена фильтров пушит несколько запросов,
  // ответы могут прийти не в том порядке. Рендерим только последний.
  let lastArchiveRequestId = 0;

  async function loadReports(): Promise<void> {
    loading.value = true;
    try {
      reports.value = await reportApi.getAvailableReports();
    } finally {
      loading.value = false;
    }
  }

  async function loadArchive(filter: IReportHistoryFilterInput = {}): Promise<boolean> {
    const myId = ++lastArchiveRequestId;
    archiveLoading.value = true;
    try {
      const page = await reportApi.getReportHistory(filter);
      if (myId !== lastArchiveRequestId) return false;
      archive.items = page?.items ?? [];
      archive.total = page?.total ?? 0;
      return true;
    } finally {
      if (myId === lastArchiveRequestId) archiveLoading.value = false;
    }
  }

  async function getReport(id: string): Promise<IGeneratedReport | undefined> {
    return reportApi.getReport(id);
  }

  async function buildInitialEdits(
    reportType: IReportType,
    year: number,
    period?: number | null,
  ): Promise<IBuildInitialReportEdits | undefined> {
    return reportApi.buildInitialReportEdits(reportType, year, period);
  }

  async function getDraft(
    reportType: IReportType,
    year: number,
    period?: number | null,
  ): Promise<IReportDraft | undefined> {
    return reportApi.getReportDraft(reportType, year, period);
  }

  async function saveDraft(input: ISaveReportDraftInput): Promise<IReportDraft | undefined> {
    return reportApi.saveReportDraft(input);
  }

  async function deleteDraft(id: string): Promise<boolean> {
    return reportApi.deleteReportDraft(id);
  }

  async function generateFromEdits(
    reportType: IReportType,
    year: number,
    period: number | null | undefined,
    editsJson: string,
  ): Promise<IGeneratedReport | undefined> {
    return reportApi.generateReportFromEdits(reportType, year, period, editsJson);
  }

  async function validateEdits(
    reportType: IReportType,
    editsJson: string,
  ): Promise<IFieldError[]> {
    return reportApi.validateReportEdits(reportType, editsJson);
  }

  async function loadCalendar(year: number): Promise<IReportCalendarRow[]> {
    return reportApi.getReportCalendar(year);
  }

  async function loadRequisites(): Promise<IReportRequisitesView | undefined> {
    return reportApi.getReportRequisites();
  }

  async function updateRequisites(
    input: IUpdateReportRequisitesInput,
  ): Promise<IReportRequisitesView | undefined> {
    return reportApi.updateReportRequisites(input);
  }

  async function checkReadiness(
    reportType: IReportType,
  ): Promise<IReportReadinessView | undefined> {
    return reportApi.checkReportReadiness(reportType);
  }

  async function markPeriod(input: IMarkReportPeriodInput): Promise<boolean> {
    return reportApi.markReportPeriod(input);
  }

  function triggerDownload(xml: string, fileName: string): void {
    // Генераторы ФНС-форм объявляют `encoding="windows-1251"` в прологе XML.
    // Если просто положить JS-строку в Blob, браузер сохранит её в utf-8 — и
    // Контур/СБИС ругаются «объявлена windows-1251, фактическая UTF-8».
    // Поэтому при cp1251-прологе перекодируем строку в байты cp1251 через
    // таблицу соответствия (пакет `windows-1251`).
    // ЕФС-1 (СФР) идёт в utf-8 — пролог это явно декларирует, оставляем строку.
    const isCp1251 = /encoding\s*=\s*(['"])\s*(windows-1251|cp-?1251)\s*\1/i.test(
      xml.slice(0, 200),
    );
    const body: BlobPart = isCp1251
      ? new Uint8Array(encodeCp1251(xml, { mode: 'replacement' }))
      : xml;
    const blob = new Blob([body], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.xml') ? fileName : fileName + '.xml';
    // Firefox/Safari требуют элемент в DOM + отложенный revoke, иначе
    // скачивание прерывается «Network error» до захвата blob браузером.
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    reports,
    loading,
    archive,
    archiveLoading,
    loadReports,
    loadArchive,
    getReport,
    buildInitialEdits,
    getDraft,
    saveDraft,
    deleteDraft,
    generateFromEdits,
    validateEdits,
    loadCalendar,
    loadRequisites,
    updateRequisites,
    checkReadiness,
    markPeriod,
    triggerDownload,
  };
});

export type ReportTypeFilter = IReportType | null;
