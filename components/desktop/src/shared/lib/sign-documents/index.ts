import { shallowRef } from 'vue';
import type { Cooperative } from 'cooptypes';
import type { ZGeneratedDocument } from 'src/shared/lib/document';

/**
 * Единое окно подписи документов.
 *
 * Любой экран отдаёт список собранных документов и получает их подписанными:
 * окно показывает документы по одному, «Продолжить» ведёт к следующему, на
 * последнем «Подписать» ставит подписи под всеми прочитанными экземплярами и
 * возвращает их вызывающему. Отправку в цепь делает вызывающий — так один и
 * тот же вид подписи служит заявлению из трёх документов, акту со второй
 * подписью и любому следующему процессу.
 *
 *     const signed = await useSignDocuments().signDocuments({ documents: [...] });
 *     if (!signed) return; // пайщик закрыл окно
 *     await createLoan({ ...base, statement: signed.statement });
 */
export interface SignDocumentItem {
  /** Ключ документа в ответе. */
  key: string;
  /** Название документа в шапке шага. */
  title: string;
  /** Документ из генератора — читается и подписывается ровно он. */
  document: ZGeneratedDocument;
  /** Номер подписи: 1 — первая, 2 — вторая под чужим экземпляром. */
  signatureId?: number;
  /** Прежние подписанные экземпляры при второй подписи. */
  existing?: Cooperative.Document.ISignedDocument2[];
}

export interface SignDocumentsRequest {
  /** Заголовок окна; по умолчанию «Подписание документов». */
  title?: string;
  documents: SignDocumentItem[];
}

export type SignedDocumentsMap = Record<string, Cooperative.Document.ISignedDocument2>;

interface PendingRequest {
  request: SignDocumentsRequest;
  resolve: (signed: SignedDocumentsMap | null) => void;
}

/** Текущий запрос подписи — его показывает хост-оверлей. */
export const pendingSignRequest = shallowRef<PendingRequest | null>(null);

export function useSignDocuments() {
  /** Показать документы и вернуть подписи; `null` — окно закрыто без подписи. */
  function signDocuments(request: SignDocumentsRequest): Promise<SignedDocumentsMap | null> {
    if (pendingSignRequest.value) pendingSignRequest.value.resolve(null);
    return new Promise((resolve) => {
      pendingSignRequest.value = { request, resolve };
    });
  }
  return { signDocuments };
}

/** Хост сообщает исход: подписи либо отказ. */
export function settleSignRequest(signed: SignedDocumentsMap | null): void {
  const pending = pendingSignRequest.value;
  pendingSignRequest.value = null;
  pending?.resolve(signed);
}
