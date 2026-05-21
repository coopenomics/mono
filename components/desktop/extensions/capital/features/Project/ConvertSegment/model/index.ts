import type { Mutations } from '@coopenomics/sdk';
import { api } from '../api';
import { useSignDocument } from 'src/shared/lib/document/model/entity';
import { useSessionStore } from 'src/entities/Session/model';
import { useSystemStore } from 'src/entities/System/model';
import { formatToAsset } from 'src/shared/lib/utils/formatToAsset';
import { useResultStore } from 'app/extensions/capital/entities/Result/model';

export type IConvertSegmentInput =
  Mutations.Capital.ConvertSegment.IInput['data'];

export function useConvertSegment() {
  const { signDocument } = useSignDocument();
  const { username } = useSessionStore();
  const { governSymbol, governPrecision } = useSystemStore();
  const resultStore = useResultStore();

  // Функция для форматирования суммы в EOSIO asset строку
  const formatToEosioAsset = (amount: number): string => {
    return formatToAsset(amount, governSymbol, governPrecision);
  };

  // Функция для генерации, подписания и конвертации сегмента
  async function convertSegmentWithDocumentGeneration(
    segmentData: {
      coopname: string;
      username: string;
      project_hash: string;
      wallet_amount: number;
      capital_amount: number;
    }
  ) {
    // 1. Генерируем документ заявления о конвертации.
    // Шаблон 1080 — универсальный: одно заявление с двумя суммами и двумя флагами.
    // appendix_hash подтягивается на бекенде по (username, project_hash).
    const generatedDocument = await api.generateConvertStatement({
      coopname: segmentData.coopname,
      username: segmentData.username,
      project_hash: segmentData.project_hash,
      main_wallet_amount: formatToEosioAsset(segmentData.wallet_amount),
      blagorost_wallet_amount: formatToEosioAsset(segmentData.capital_amount),
      to_wallet: segmentData.wallet_amount > 0,
      to_blagorost: segmentData.capital_amount > 0,
    });

    // 2. Подписываем документ конвертации
    const signedDocument = await signDocument(
      generatedDocument,
      username,
      1, // signatureId = 1 для одинарной подписи
    );

    // 3. Получаем result_hash из объекта результата (анкер процесса p.cap.rid).
    // Контракт convertsegm проверит, что result существует и в статусе ACT2.
    const result = await resultStore.loadResultByFilters(segmentData.username, segmentData.project_hash);
    if (!result) {
      throw new Error('Объект результата не найден — внесение РИД не завершено (нужен signact2 от председателя).');
    }

    const convertData: IConvertSegmentInput = {
      coopname: segmentData.coopname,
      username: segmentData.username,
      project_hash: segmentData.project_hash,
      result_hash: result.result_hash,
      wallet_amount: formatToEosioAsset(segmentData.wallet_amount),
      capital_amount: formatToEosioAsset(segmentData.capital_amount),
      convert_statement: signedDocument,
    };

    const updatedSegment = await api.convertSegment(convertData);
    return updatedSegment;
  }

  return { convertSegmentWithDocumentGeneration };
}
