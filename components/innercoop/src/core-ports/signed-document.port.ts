/**
 * Подписанный документ кооператива — то, что расширение отдаёт ядру на проверку
 * и регистрацию, и то, что получает обратно из реестра.
 *
 * Контракт переехал из `~/domain/document/interfaces` контроллера: на него
 * ссылались 79 файлов расширений, а этого пути за пределами монолита нет.
 * Зависимостей у него нет — только два соседних контракта здесь же.
 *
 * Имена сохранены как были (`I...DomainInterface`). Суффикс избыточен и канону
 * пакета не соответствует, но переименование затронуло бы больше двухсот точек
 * в ядре и расширениях; это отдельная механическая правка, а не побочный
 * эффект переезда.
 */
import type { IMetaDocumentDomainInterface } from './meta-document.contract';
import type { ISignatureInfoDomainInterface } from './signature-info.contract';

export type ISignedDocumentDomainInterface = {
  version: string;
  hash: string;
  doc_hash: string;
  meta_hash: string;
  meta: IMetaDocumentDomainInterface & { [key: string]: any };
  signatures: ISignatureInfoDomainInterface[];
};
