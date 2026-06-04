import { ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';

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
      if (result.status === 'failed') {
        lastError.value = result.error || 'Не удалось зарегистрировать пакет';
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
