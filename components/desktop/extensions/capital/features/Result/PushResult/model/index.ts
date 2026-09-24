import { ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import {
  useResultStore,
  type IPushResultOutput,
} from 'app/extensions/capital/entities/Result/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { t } from '../../../../i18n';

export type IPushResultInput = Mutations.Capital.PushResult.IInput['data'];

export function usePushResult() {
  const store = useResultStore();
  const session = useSessionStore();
  const segmentStore = useSegmentStore();
  const projectStore = useProjectStore();

  // Состояния для генерации документов
  const isGenerating = ref(false);
  const generationError = ref(false);

  async function pushResult(
    data: IPushResultInput,
  ): Promise<IPushResultOutput> {
    const transaction = await api.pushResult(data);

    // Обновляем список результатов после добавления
    await store.loadResults({});

    return transaction;
  }

  // Генерация заявления на паевой взнос
  async function generateResultContributionStatement(projectHash: string): Promise<IGeneratedDocumentOutput | null> {
    try {
      generationError.value = false;

      const data = {
        project_hash: projectHash,
        username: session.username,
      };

      const document = await api.generateResultContributionStatement(data);
      return document;
    } catch (error) {
      console.error('Ошибка при генерации заявления на паевой взнос:', error);
      generationError.value = true;
      throw error;
    }
  }

  // Создание результата с сгенерированным и подписанным заявлением
  async function pushResultWithGeneratedStatement(
    projectHash: string,
    username: string,
  ): Promise<IPushResultOutput> {

    // Генерируем заявление
    const document = await generateResultContributionStatement(projectHash);
    if (!document) {
      throw new Error(t('capital.error.statementGenerationFailed'));
    }

    // Подписываем документ
    const digitalDocument = new DigitalDocument(document);
    const signedDoc = await digitalDocument.sign(session.username);

    // Создаем объект результата - передаем подписанное заявление для сверки
    const resultData: IPushResultInput = {
      project_hash: projectHash,
      username: username,
      statement: signedDoc,
    };

    // Отправляем результат
    const updatedSegment = await pushResult(resultData);

    // Обновляем сегмент в сторе напрямую
    if (updatedSegment) {
      segmentStore.addSegmentToList(projectHash, updatedSegment);
    }

    // Обновляем проект в списке
    try {
      await projectStore.loadProject({
        hash: projectHash,
      });
    } catch (error) {
      console.warn('Не удалось обновить проект после внесения результата:', error);
    }

    return updatedSegment;
  }

  return {
    pushResult,
    // Новые функции для работы с заявлениями
    generateResultContributionStatement,
    pushResultWithGeneratedStatement,
    // Состояния генерации
    isGenerating,
    generationError,
  };
}
