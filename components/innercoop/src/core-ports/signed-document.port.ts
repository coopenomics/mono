/**
 * Подписанный документ кооператива — то, что расширение отдаёт ядру на проверку
 * и регистрацию, и то, что получает обратно из реестра.
 *
 * Контракт переехал из `~/domain/document/interfaces` контроллера: на него
 * ссылались 79 файлов расширений, а этого пути за пределами монолита нет.
 * Зависимостей у него нет — только два соседних контракта здесь же.
 *
 * Суффикс `DomainInterface` снят при переезде: тип и `I`-префиксом помечен, и
 * «интерфейсом» назван — повтор ни о чём не говорит.
 */
import type { IMetaDocument } from './meta-document.contract';
import type { ISignatureInfo } from './signature-info.contract';

export type ISignedDocument = {
  version: string;
  hash: string;
  doc_hash: string;
  meta_hash: string;
  meta: IMetaDocument & { [key: string]: any };
  signatures: ISignatureInfo[];
};
