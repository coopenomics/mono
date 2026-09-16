import { ref } from 'vue';
import { api } from '../api';
import { signDocument } from 'src/shared/lib/document';
import { useSessionStore } from 'src/entities/Session/model';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import type { ISignActAsContributorInput, ISignActAsChairmanInput } from './types';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import { useResultStore } from 'app/extensions/capital/entities/Result/model';

export * from './types';

export function useSignAct() {
  const { username } = useSessionStore();
  const segmentStore = useSegmentStore();
  const resultStore = useResultStore();

  const isLoading = ref(false);

  /**
   * Подписание акта участником (первая подпись).
   * Участник генерирует акт, подписывает его и отправляет в блокчейн.
   * Председатель позже наложит вторую подпись на этот акт.
   */
  const signActAsContributor = async (
    segment: ISegment,
    coopname: string,
  ): Promise<ISegment> => {
    isLoading.value = true;
    try {
      if (!segment.username) {
        throw new Error('Имя пользователя не найдено');
      }

      // Получаем result для извлечения result_hash
      const result = await resultStore.loadResultByFilters(segment.username, segment.project_hash);
      if (!result) {
        throw new Error('Результат не найден');
      }

      // Генерируем акт
      const generatedDocument = await api.generateResultContributionAct({
        username: segment.username,
        result_hash: result.result_hash
      });

      // Подписываем документ первой подписью (signatureId = 1)
      const signedDocument = await signDocument(
        generatedDocument,
        username,
        1, // signatureId = 1 для первой подписи
      );

      // Отправляем подписанный акт в блокчейн
      const input: ISignActAsContributorInput = {
        coopname,
        result_hash: result.result_hash,
        act: signedDocument,
      };
      const updatedSegment = await api.signActAsContributor(input);

      // Обновляем сегмент в сторе
      if (updatedSegment) {
        segmentStore.addSegmentToList(segment.project_hash, updatedSegment);
      }

      return updatedSegment;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Подписание акта председателем (вторая подпись).
   * Председатель НЕ генерирует новый акт, а берет уже подписанный участником акт из блокчейна,
   * накладывает на него свою подпись и отправляет обратно в блокчейн.
   */
  const signActAsChairman = async (
    segment: ISegment,
    coopname: string,
  ): Promise<ISegment> => {
    isLoading.value = true;
    try {
      if (!segment.username) {
        throw new Error('Имя пользователя не найдено');
      }

      // Получаем result для извлечения уже подписанного участником акта
      const result = await resultStore.loadResultByFilters(segment.username, segment.project_hash);
      if (!result) {
        throw new Error('Результат не найден');
      }

      // Проверяем наличие подписанного акта от участника
      if (!result.act) {
        throw new Error('Акт от участника не найден. Участник должен сначала подписать акт.');
      }

      // Проверяем наличие rawDocument для наложения второй подписи
      if (!result.act.rawDocument) {
        throw new Error('Сырой документ акта не найден. Невозможно наложить вторую подпись.');
      }

      // Накладываем вторую подпись председателя на существующий акт
      const doubleSignedDocument = await signDocument(
        result.act.rawDocument, // Сырой документ (необходим для генерации новой подписи)
        username, // Имя председателя
        2, // signatureId = 2 для второй подписи
        [result.act.document], // Существующая подпись участника
      );

      // Отправляем акт с двойной подписью в блокчейн
      const input: ISignActAsChairmanInput = {
        coopname,
        result_hash: result.result_hash,
        act: doubleSignedDocument,
      };

      const updatedSegment = await api.signActAsChairman(input);

      // Обновляем сегмент в сторе
      if (updatedSegment) {
        segmentStore.addSegmentToList(segment.project_hash, updatedSegment);
      }

      return updatedSegment;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    signActAsContributor,
    signActAsChairman,
    isLoading,
  };
}
