import { ref, computed } from 'vue';
import { useImportContributor } from 'app/extensions/capital/features/Contributor/ImportContributor/model';
import { useSystemStore } from 'src/entities/System/model';
import type { ICsvContributor } from './useCsvParser';
import { t } from '../../../i18n';

export function useBatchImport() {
  const { importContributor } = useImportContributor();
  const { info } = useSystemStore();

  const importProgress = ref(0);
  const isImporting = ref(false);
  const currentImportIndex = ref(-1);
  const importedCount = ref(0);
  const failedCount = ref(0);

  const importResults = ref<ICsvContributor[]>([]);

  const totalItems = computed(() => importResults.value.length);
  const successCount = computed(() => importedCount.value);
  const errorCount = computed(() => failedCount.value);
  const progressPercent = computed(() => {
    if (totalItems.value === 0) return 0;
    return Math.round((importProgress.value / totalItems.value) * 100);
  });

  const startBatchImport = async (contributors: ICsvContributor[]) => {
    if (isImporting.value) return;

    isImporting.value = true;
    importProgress.value = 0;
    currentImportIndex.value = -1;
    importedCount.value = 0;
    failedCount.value = 0;
    importResults.value = contributors.map((c) => ({ ...c }));

    for (let i = 0; i < contributors.length; i++) {
      currentImportIndex.value = i;
      const contributor = contributors[i];

      try {
        await importContributor({
          coopname: info.coopname,
          username: contributor.username,
          contribution_amount: contributor.contribution_amount,
          contributor_contract_number: contributor.contributor_contract_number,
          contributor_contract_created_at: contributor.contributor_contract_created_at,
          blagorost_agreement_number: contributor.blagorost_agreement_number,
          blagorost_agreement_created_at: contributor.blagorost_agreement_created_at,
          memo: contributor.memo,
        });

        importResults.value[i].status = 'success';
        importedCount.value++;
      } catch (error: any) {
        importResults.value[i].status = 'error';
        importResults.value[i].error = error.message || t('capital.useBatchImport.unknownError');
        failedCount.value++;
      }

      importProgress.value = i + 1;

      // timing: throttle — пакетный импорт не всплеском запросов, а по одному
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    isImporting.value = false;
    currentImportIndex.value = -1;
  };

  const retryImport = async (index: number) => {
    if (isImporting.value || index >= importResults.value.length) return;

    const contributor = importResults.value[index];
    if (contributor.status === 'success') return;

    try {
      await importContributor({
        coopname: info.coopname,
        username: contributor.username,
        contribution_amount: contributor.contribution_amount,
        contributor_contract_number: contributor.contributor_contract_number,
        contributor_contract_created_at: contributor.contributor_contract_created_at,
        blagorost_agreement_number: contributor.blagorost_agreement_number,
        blagorost_agreement_created_at: contributor.blagorost_agreement_created_at,
        memo: contributor.memo,
      });

      importResults.value[index].status = 'success';
      importResults.value[index].error = undefined;
      importedCount.value++;
      if (failedCount.value > 0) failedCount.value--;
    } catch (error: any) {
      importResults.value[index].status = 'error';
      importResults.value[index].error = error.message || t('capital.useBatchImport.unknownError');
    }
  };

  const stopImport = () => {
    isImporting.value = false;
    currentImportIndex.value = -1;
  };

  const resetImport = () => {
    importProgress.value = 0;
    isImporting.value = false;
    currentImportIndex.value = -1;
    importedCount.value = 0;
    failedCount.value = 0;
    importResults.value = [];
  };

  return {
    // Состояние
    importProgress,
    isImporting,
    currentImportIndex,
    importedCount,
    failedCount,
    importResults,

    // Вычисляемые свойства
    totalItems,
    successCount,
    errorCount,
    progressPercent,

    // Методы
    startBatchImport,
    retryImport,
    stopImport,
    resetImport,
  };
}
