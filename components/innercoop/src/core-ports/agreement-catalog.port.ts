/**
 * Справочник оферт кооператива — что вообще предлагается подписать.
 *
 * Отличается от реестра, в который расширение свои оферты кладёт: здесь оно
 * их читает, например чтобы узнать номер шаблона своей оферты и показать её
 * пайщику.
 */
export interface InnerAgreementCatalogItem {
  id: string;
  /** Номер шаблона документа в реестре платформы. */
  registry_id: number;
  title: string;
  [key: string]: any;
}

export interface IAgreementCatalogPort {
  /** Оферта по идентификатору; `null`, если такой нет. */
  getAgreementById(id: string): InnerAgreementCatalogItem | null;
}

export const AGREEMENT_CATALOG_PORT = Symbol.for('Innercoop.CorePort.AgreementCatalog');
