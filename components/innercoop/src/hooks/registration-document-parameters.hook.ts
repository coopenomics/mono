/**
 * Параметры оферты, которые расширение выдаёт вступающему пайщику.
 *
 * Направление обратное портам ядра: контракт реализует расширение, а вызывает
 * ядро — в потоке вступления, когда пайщик выбрал соответствующую программу.
 *
 * Операция обязана быть идемпотентной: повторный вызов не перевыдаёт уже
 * выданные номер и дату соглашения. Иначе документ при повторном рендере
 * получит другой хэш, и подпись пайщика перестанет к нему подходить.
 *
 * Ядро инжектит хуки необязательными: расширение может быть не установлено в
 * кооперативе, и это нормальный случай, а не сбой.
 */

/**
 * Оферты Благороста и Генератора.
 *
 * Методы перечислены по офертам, а не сведены к одной операции с признаком:
 * так они и вызываются в потоке вступления сегодня. Сведение к одной операции —
 * отдельный шаг, он меняет ветвление в ядре и требует согласования.
 */
export interface IProgramDocumentParametersHook {
  generateBlagorostOfferParameters(coopname: string, username: string): Promise<void>;
  generateGeneratorOfferParameters(coopname: string, username: string): Promise<void>;
  /** Договор о порядке участия в хозяйственной деятельности. */
  generateGenerationContractParameters(coopname: string, username: string): Promise<void>;
  generateStorageAgreementParameters(coopname: string, username: string): Promise<void>;
  /** Для пути Генератора: доготовить параметры Благороста, если их ещё нет. */
  generateBlagorostAgreementParametersIfNotExist(coopname: string, username: string): Promise<void>;
}

export const PROGRAM_DOCUMENT_PARAMETERS_HOOK = Symbol.for('Innercoop.Hook.ProgramDocumentParameters');

/**
 * Оферта Стола заказов. Отдельно от программного хука намеренно: Стол заказов —
 * самостоятельное расширение и может стоять в кооперативе без Благороста.
 */
export interface IMarketplaceDocumentParametersHook {
  generateMarketplaceOfferParameters(coopname: string, username: string): Promise<void>;
}

export const MARKETPLACE_DOCUMENT_PARAMETERS_HOOK = Symbol.for('Innercoop.Hook.MarketplaceDocumentParameters');
