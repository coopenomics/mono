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
 * Доставка — через реестр ниже: расширение кладёт свою реализацию туда при
 * запуске, а ядро читает. Пустой слот — нормальный случай, а не сбой:
 * расширения может не быть в кооперативе.
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

/**
 * Оферта Стола заказов. Отдельно от программного хука намеренно: Стол заказов —
 * самостоятельное расширение и может стоять в кооперативе без Благороста.
 */
export interface IMarketplaceDocumentParametersHook {
  generateMarketplaceOfferParameters(coopname: string, username: string): Promise<void>;
}

/**
 * Параметры оферт любой программы по её ключу — общий путь для новых
 * расширений. Ядро, собирая документы вступления по выбранной программе,
 * ищет хук по `programKey` и зовёт его до генерации: расширение пишет в Udata
 * персональные номер и дату, которые потом читает фабрика документа.
 * Именованные хуки выше остаются для Благороста и Стола заказов.
 */
export interface IProgramOfferParametersHook {
  /** Ключ программы из `ProgramKey`, за документы которой отвечает хук. */
  readonly programKey: string;
  generateOfferParameters(coopname: string, username: string): Promise<void>;
}

/**
 * Реестр хуков. Расширение кладёт свою реализацию сюда при запуске, а вызывает
 * её ядро, когда собирает документы вступления.
 *
 * Реестр нужен именно потому, что направление обратное: инъекция по токену
 * хука требует, чтобы модуль ядра видел провайдера расширения, а видимость в
 * Nest даёт только импорт — то есть ядро импортировало бы модуль расширений и
 * получало цикл. Расширение же видит ядро всегда: порты ему раздаёт глобальный
 * мост. Тот же приём, что у прав рабочего стола (`IDesktopGrantsRegistryPort`).
 */
export interface IRegistrationDocumentParametersRegistryPort {
  /** Оферты Благороста и Генератора. */
  registerProgramHook(hook: IProgramDocumentParametersHook): void;
  /** Оферта Стола заказов. */
  registerMarketplaceHook(hook: IMarketplaceDocumentParametersHook): void;
  /** Оферты программы по ключу — для всех последующих расширений. */
  registerProgramOfferHook(hook: IProgramOfferParametersHook): void;
}

export const REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.RegistrationDocumentParametersRegistry');
