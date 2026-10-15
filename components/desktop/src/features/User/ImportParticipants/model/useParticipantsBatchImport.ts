import { computed, ref } from 'vue';
import { api } from 'src/features/User/AddUser/api';
import type { ParticipantCsvRow } from './types';
import { extractGraphQLErrorMessages } from 'src/shared/api';
import { t } from 'src/shared/i18n';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useParticipantsBatchImport() {
  const importResults = ref<ParticipantCsvRow[]>([]);
  const isImporting = ref(false);
  const importProgress = ref(0);
  const currentImportIndex = ref(-1);
  const stopRequested = ref(false);

  const successCount = computed(
    () => importResults.value.filter((row) => row.status === 'success').length,
  );
  const errorCount = computed(
    () => importResults.value.filter((row) => row.status === 'error').length,
  );
  const progressPercent = computed(() => {
    if (!importResults.value.length) return 0;
    return Math.round((importProgress.value / importResults.value.length) * 100);
  });

  const startBatchImport = async (
    rows: ParticipantCsvRow[],
    options?: { spreadInitial: boolean },
  ) => {
    if (isImporting.value) return;
    importResults.value = rows.map((row) => ({ ...row }));
    isImporting.value = true;
    importProgress.value = 0;
    stopRequested.value = false;

    for (let i = 0; i < importResults.value.length; i++) {
      if (stopRequested.value) break;
      currentImportIndex.value = i;
      const row = importResults.value[i];

      if (row.status === 'error' || !row.input) {
        importProgress.value = i + 1;
        continue;
      }

      try {
        if (options?.spreadInitial && row.input) {
          row.input.spread_initial = true;
        }
        await api.addParticipant(row.input);
        row.status = 'success';
        row.error = undefined;
      } catch (e: any) {
        row.status = 'error';
        console.error('import user error: ', e)
        row.error = extractGraphQLErrorMessages(e);
      }

      importProgress.value = i + 1;
      // timing: throttle — пакетный импорт пайщиков не всплеском запросов, а по одному
      await delay(120);
    }

    isImporting.value = false;
    currentImportIndex.value = -1;
  };

  const retryImport = async (index: number) => {
    const row = importResults.value[index];
    if (!row || !row.input || isImporting.value) return;
    try {
      await api.addParticipant(row.input);
      row.status = 'success';
      row.error = undefined;
    } catch (e: any) {
      row.status = 'error';
      row.error = e?.message ?? t('user.batchImport.unknownError');
    }
  };

  const retryAllFailed = async () => {
    for (let i = 0; i < importResults.value.length; i++) {
      if (importResults.value[i].status === 'error') {
        await retryImport(i);
      }
    }
  };

  const stopImport = () => {
    stopRequested.value = true;
  };

  const resetImport = () => {
    importResults.value = [];
    importProgress.value = 0;
    currentImportIndex.value = -1;
    isImporting.value = false;
    stopRequested.value = false;
  };

  return {
    importResults,
    isImporting,
    importProgress,
    currentImportIndex,
    successCount,
    errorCount,
    progressPercent,
    startBatchImport,
    retryImport,
    retryAllFailed,
    stopImport,
    resetImport,
  };
}
