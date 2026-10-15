import { useBranchStore } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { deleteBranch as apiDeleteBranch } from '../api';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { ref } from 'vue';
import { t } from 'src/shared/i18n';

export function useDeleteBranch() {
  const branchStore = useBranchStore();
  const systemStore = useSystemStore();
  const loading = ref(false);

  const deleteBranch = async (data: { coopname: string; braname: string; short_name: string }): Promise<boolean> => {
    try {
      loading.value = true;
      const result = await apiDeleteBranch({
        coopname: data.coopname,
        braname: data.braname
      });

      if (result) {
        SuccessAlert(t('branch.deleteBranchModel.deleteSuccess', { shortName: data.short_name }));

        // После успешного удаления обновляем состояние системы и списка участков
        await systemStore.loadSystemInfo();
        await branchStore.loadBranches({
          coopname: data.coopname
        });

        return true;
      }
      return false;
    } catch (error: any) {
      FailAlert(error);
      return false;
    } finally {
      loading.value = false;
    }
  };

  return {
    deleteBranch,
    loading
  };
}
