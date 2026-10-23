import { ref } from 'vue';
import { Zeus, type Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import { t } from '../../../i18n';

export type IPublishPackageInput = Mutations.Extensions.PublishPackage.IInput['data'];
export type IPublishPackageOutput = Mutations.Extensions.PublishPackage.IOutput['publishPackage'];

export function usePublishPackage() {
  const isSubmitting = ref(false);
  const lastResult = ref<IPublishPackageOutput | null>(null);
  const lastError = ref<string | null>(null);

  async function submit(input: IPublishPackageInput): Promise<IPublishPackageOutput> {
    isSubmitting.value = true;
    lastError.value = null;
    try {
      const result = await api.publishPackage(input);
      lastResult.value = result;
      if (result.status === Zeus.PublishPackageStatus.FAILED) {
        lastError.value = result.error || t('developer.publishPackage.failed');
      }
      return result;
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    isSubmitting,
    lastResult,
    lastError,
    submit,
  };
}
