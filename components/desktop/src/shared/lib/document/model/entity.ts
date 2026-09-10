import type { IGenerate, IGeneratedDocument } from './types';
import { api } from '../api';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert } from 'src/shared/api';
import type { IDocument, IMetaDocument } from 'src/shared/lib/types/document';
import type { Cooperative } from 'cooptypes';
import { Classes } from '@coopenomics/sdk';
import type { ISignedDocument2 } from 'src/entities/Document/model';

export type ZGeneratedDocument = Cooperative.Document.ZGeneratedDocument;

/**
 * Единственная точка подписи документов на десктопе.
 *
 * Ключ наружу не выдаётся: он берётся из хранилища через `ensureSigningKey`
 * прямо здесь, и запертый PIN-кодом кошелёк — не ошибка, а повод спросить
 * PIN-код. Окно PIN-кода поднимается само, подпись продолжается после
 * разблокировки; отказ — ошибка «Для подписи нужен PIN-код», которую
 * вызывающий показывает как любую другую.
 *
 * Экраны и API-функции не создают подписанта сами и не таскают ключ
 * параметром: раньше так делал Стол заказов в десяти местах, и каждое
 * решало про PIN-код по-своему — автоподпись акта при запертом ключе
 * просто сдавалась (решение владельца 2026-09-09: любая подпись любого
 * документа — через одно место).
 */
export async function signDocument(
  document: ZGeneratedDocument,
  account: string,
  signatureId = 1,
  existingSignedDocuments?: ISignedDocument2[],
): Promise<Cooperative.Document.ISignedDocument2> {
  if (!document) throw new Error('Документ на подпись не предоставлен');
  const wifKey = await useGlobalStore().ensureSigningKey();
  const docSigner = new Classes.Document(wifKey);
  return await docSigner.signDocument(document, account, signatureId, existingSignedDocuments);
}

/**
 * Отпереть ключ заранее — перед серией подписей. Нужно там, где акты
 * подписываются параллельно или в цикле: иначе PIN-код спросился бы на
 * первой подписи посреди работы, а при отказе каждая подпись серии упала
 * бы своей ошибкой. Отказ показывается один раз, и вызывающий выходит:
 *
 *     if (!(await ensureSigningUnlocked())) return;
 */
export async function ensureSigningUnlocked(text?: string): Promise<boolean> {
  try {
    await useGlobalStore().ensureSigningKey();
    return true;
  } catch (e) {
    FailAlert(e, text);
    return false;
  }
}


export class DigitalDocument {
  public data: IGeneratedDocument | undefined;
  public signedDocument: IDocument | undefined;

  constructor(document?: IGeneratedDocument) {
    this.data = document;
  }

  async generate<T extends IGenerate>(
    data: T,
    options?: Cooperative.Document.IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    this.data = await api.generateDocument(data, options);
    return this.data;
  }

  /**
   * Подписывает документ
   */
  async sign<T extends IMetaDocument>(
    account: string,
    signatureId = 1,
  ): Promise<IDocument<T>> {
    if (!this.data) throw new Error('Ошибка генерации документа');
    const signedDoc = await signDocument(this.data, account, signatureId);
    this.signedDocument = signedDoc;
    return signedDoc;
  }
}
