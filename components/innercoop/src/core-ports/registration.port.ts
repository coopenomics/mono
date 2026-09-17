import type { InnerAccountType } from './account.port';

/**
 * Оферты и программы участия, которые расширение предлагает вступающему
 * пайщику.
 *
 * Расширение наполняет реестр при запуске, а показывает предложения ядро — в
 * форме вступления и в списке программ. Ядро о конкретных расширениях не
 * знает. Раньше инжектился `AGREEMENT_REGISTRATION_PORT` по пути
 * `~/domain/registration`, которого за пределами монолита нет.
 *
 * Повторная регистрация с тем же идентификатором от того же расширения
 * перезаписывает запись, а не заводит вторую: при перезапуске расширение
 * объявляет свои оферты заново.
 */

/** Программы участия, известные платформе. */
export enum ProgramKey {
  /** Генерация — вклад временем, имуществом или деньгами в конкретные проекты. */
  GENERATION = 'GENERATION',
  /** Капитализация — вклад имуществом или деньгами в систему. */
  CAPITALIZATION = 'CAPITALIZATION',
  /** Стол заказов — совместные закупки. */
  MARKETPLACE = 'MARKETPLACE',
  /** Программа не определена. */
  UNDEFINED = 'UNDEFINED',
}

export interface InnerAgreementRegistration {
  /** Идентификатор оферты; пространство имён расширение задаёт само. */
  id: string;

  /**
   * Номер шаблона документа в реестре платформы — единственный источник текста
   * оферты. Параллельной копии текста платформа не хранит.
   */
  registry_id: number;

  /**
   * Тип соглашения для записи в цепь. Обязан быть допустимым именем цепи
   * (не длиннее двенадцати символов из `.a-z1-5`, без подчёркивания) и уже
   * существовать в справочнике соглашений — иначе подпись оферты не пройдёт.
   */
  agreement_type: string;

  title: string;
  /** Текст рядом с галочкой согласия. */
  checkbox_text: string;
  /** Текст ссылки, открывающей оферту для чтения. */
  link_text: string;

  /**
   * Кому оферта предлагается. Пустой список означает, что оферта не показывается
   * сама по себе, а идёт в связке с программой.
   */
  applicable_account_types: InnerAccountType[];

  order: number;

  /** Расширение-владелец: по нему реестр вычищается при остановке расширения. */
  extension_name: string;

  /**
   * Если шаблон оферты требует приватной части, расширение отдаёт её хэш.
   * Вызывается на каждую генерацию и не кэшируется: совет может пересохранить
   * параметры программы без перезапуска.
   */
  resolve_doc_data_hash?: () => Promise<string | undefined>;
}

export interface InnerProgramRegistration {
  key: string;
  title: string;
  description: string;
  image_url?: string;
  requirements?: string;
  applicable_account_types: InnerAccountType[];
  /** Оферты, которые пайщик подписывает, выбрав программу. */
  agreement_ids: string[];
  /** Анкеты, которые заявитель заполняет, выбрав программу. */
  intake_form_ids?: string[];
  order: number;
  extension_name: string;
}

/**
 * Поле анкеты в JSON Schema.
 *
 * Через порт идут данные, а не объект с методами: расширение описывает анкету
 * Zod-схемой с описанием полей (как свои настройки) и отдаёт сюда результат
 * `zodToJsonSchema`. По этим же данным ядро строит форму и проверяет ответы,
 * поэтому поддержано то, что ядро умеет проверить: строка, число, флажок,
 * перечисление и вложенный объект.
 */
export interface InnerIntakeJsonSchemaProperty {
  type?: string;
  /**
   * Описание поля: подпись, пояснение, многострочность. Строка JSON из
   * `describeField` либо уже разобранный объект.
   */
  description?: unknown;
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  properties?: Record<string, InnerIntakeJsonSchemaProperty>;
  required?: string[];
  [key: string]: unknown;
}

/** Схема анкеты: объект хотя бы с одним полем, у каждого поля есть подпись. */
export interface InnerIntakeJsonSchema extends InnerIntakeJsonSchemaProperty {
  properties?: Record<string, InnerIntakeJsonSchemaProperty>;
}

/**
 * Анкета, которую расширение просит заполнить при вступлении.
 *
 * Это сведения для совета, а не документ: они не подписываются и в цепь не
 * идут. Без ответа, проходящего схему, ядро заявку не принимает.
 */
export interface InnerIntakeFormRegistration {
  /** Идентификатор анкеты; пространство имён расширение задаёт само. */
  id: string;

  /** Расширение-владелец: по нему реестр вычищается при остановке расширения. */
  extension_name: string;

  /** Заголовок анкеты на шаге вступления. */
  title: string;

  /** Абзац над полями: зачем кооперативу эти сведения. */
  description?: string;

  /** Поля анкеты — JSON Schema, полученная из Zod-схемы расширения. */
  schema: InnerIntakeJsonSchema;

  /**
   * Кому анкета предлагается. Пустой список означает, что анкета не
   * показывается сама по себе, а идёт в связке с программой.
   */
  applicable_account_types: InnerAccountType[];

  order: number;
}

export interface IRegistrationRegistryPort {
  registerAgreement(spec: InnerAgreementRegistration): void;

  /** Снять оферту вручную; при остановке расширения реестр чистится сам. */
  unregisterAgreement(id: string, extensionName: string): void;

  registerProgram(spec: InnerProgramRegistration): void;

  unregisterProgram(key: string, extensionName: string): void;

  registerIntakeForm(spec: InnerIntakeFormRegistration): void;

  /** Снять анкету вручную; при остановке расширения реестр чистится сам. */
  unregisterIntakeForm(id: string, extensionName: string): void;
}

export const REGISTRATION_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.RegistrationRegistry');
