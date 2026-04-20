import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import { reportApi } from '../api';
import type {
  IAvailableReport,
  IGeneratedReport,
  IGenerateReportInput,
  IReportHistoryFilterInput,
  IReportHistoryPage,
  IReportType,
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

  async function generate(data: IGenerateReportInput): Promise<IGeneratedReport | undefined> {
    return reportApi.generateReport(data);
  }

  function triggerDownload(xml: string, fileName: string): void {
    // MIME без явного charset: для ФНС XML cp1251, для СФР ЕФС-1 utf-8 —
    // пусть парсер полагается на декларацию <?xml ... encoding=...?> внутри.
    const blob = new Blob([xml], { type: 'application/xml' });
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
    generate,
    triggerDownload,
  };
});

export type ReportTypeFilter = IReportType | null;
