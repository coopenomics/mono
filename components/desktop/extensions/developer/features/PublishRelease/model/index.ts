import { ref } from 'vue';
import { Zeus, type Mutations } from '@coopenomics/sdk';
import { api } from '../api';

export type IPublishReleaseInput = Mutations.Extensions.PublishRelease.IInput['data'];
export type IPublishReleaseOutput = Mutations.Extensions.PublishRelease.IOutput['publishRelease'];

export function usePublishRelease() {
  const isSubmitting = ref(false);
  const lastResult = ref<IPublishReleaseOutput | null>(null);
  const lastError = ref<string | null>(null);

  async function submit(input: IPublishReleaseInput): Promise<IPublishReleaseOutput> {
    isSubmitting.value = true;
    lastError.value = null;
    try {
      const result = await api.publishRelease(input);
      lastResult.value = result;
      if (
        result.status === Zeus.PublishReleaseStatus.FAILED ||
        result.status === Zeus.PublishReleaseStatus.INVALID_MANIFEST ||
        result.status === Zeus.PublishReleaseStatus.NOT_PUBLISHED ||
        result.status === Zeus.PublishReleaseStatus.CONFLICT
      ) {
        lastError.value = result.error || 'Не удалось опубликовать релиз';
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
