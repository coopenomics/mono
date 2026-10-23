import { defineStore } from 'pinia';
import { ref, Ref } from 'vue';
import { api } from '../api';
import type { ITranscription, ITranscriptionWithSegments } from './types';
import { t as i18nT } from '../../../i18n';

const namespace = 'transcriptionStore';

interface ITranscriptionStore {
  transcriptions: Ref<ITranscription[]>;
  currentTranscription: Ref<ITranscriptionWithSegments | null>;
  isLoading: Ref<boolean>;
  isLoadingDetail: Ref<boolean>;
  error: Ref<string | null>;
  loadTranscriptions: (limit?: number, offset?: number, matrixRoomId?: string) => Promise<ITranscription[]>;
  loadTranscription: (id: string) => Promise<ITranscriptionWithSegments | null>;
  /** Подставить в кэш «шапку» транскрипции с сервера (после мутации из фичи), без HTTP */
  applyTranscriptionHeadFromServer: (head: ITranscription) => void;
  clearTranscriptions: () => void;
  clearCurrentTranscription: () => void;
  clearError: () => void;
}

export const useTranscriptionStore = defineStore(
  namespace,
  (): ITranscriptionStore => {
    const transcriptions = ref<ITranscription[]>([]);
    const currentTranscription = ref<ITranscriptionWithSegments | null>(null);
    const isLoading = ref(false);
    const isLoadingDetail = ref(false);
    const error = ref<string | null>(null);

    const loadTranscriptions = async (
      limit?: number,
      offset?: number,
      matrixRoomId?: string
    ): Promise<ITranscription[]> => {
      isLoading.value = true;
      error.value = null;

      try {
        const result = await api.getTranscriptions({ limit, offset, matrixRoomId });
        transcriptions.value = result;
        return result;
      } catch (err) {
        console.error('Failed to load transcriptions:', err);
        error.value = i18nT('chatcoop.transcriptionStore.loadListError');
        return [];
      } finally {
        isLoading.value = false;
      }
    };

    const loadTranscription = async (id: string): Promise<ITranscriptionWithSegments | null> => {
      isLoadingDetail.value = true;
      error.value = null;

      try {
        const result = await api.getTranscription(id);
        currentTranscription.value = result;
        return result;
      } catch (err) {
        console.error('Failed to load transcription:', err);
        error.value = i18nT('chatcoop.transcriptionStore.loadOneError');
        return null;
      } finally {
        isLoadingDetail.value = false;
      }
    };

    const applyTranscriptionHeadFromServer = (head: ITranscription): void => {
      const cur = currentTranscription.value;
      if (cur?.transcription.id === head.id) {
        currentTranscription.value = {
          ...cur,
          transcription: { ...cur.transcription, ...head },
        };
      }
      const listIdx = transcriptions.value.findIndex((t) => t.id === head.id);
      if (listIdx >= 0) {
        transcriptions.value[listIdx] = { ...transcriptions.value[listIdx], ...head };
      }
    };

    const clearTranscriptions = () => {
      transcriptions.value = [];
    };

    const clearCurrentTranscription = () => {
      currentTranscription.value = null;
    };

    const clearError = () => {
      error.value = null;
    };

    return {
      transcriptions,
      currentTranscription,
      isLoading,
      isLoadingDetail,
      error,
      loadTranscriptions,
      loadTranscription,
      applyTranscriptionHeadFromServer,
      clearTranscriptions,
      clearCurrentTranscription,
      clearError,
    };
  },
);
