/** Состояние шаблона поздравления. */
export enum GreetingTemplateStatus {
  /** Черновик: председатель пишет текст, рассылка шаблон не берёт. */
  DRAFT = 'draft',
  /** Действует: рассылка берёт шаблон в дни его периода. */
  ACTIVE = 'active',
}

/** Повод шаблона. */
export enum GreetingTemplateKind {
  /** Поздравление каждому пайщику в его день рождения. */
  BIRTHDAY = 'birthday',
  /** Информационная рассылка всем действующим пайщикам в дату. */
  MAILING = 'mailing',
}

/** Итог поздравления пайщика в конкретном году. */
export enum GreetingSendStatus {
  /** Центр уведомлений принял письмо к доставке. */
  SENT = 'sent',
  /** Поздравление не отправлено: нет действующего шаблона, почты или членства. */
  SKIPPED = 'skipped',
  /** Отправка упала; следующий запуск рассылки в тот же день повторит её. */
  FAILED = 'failed',
}

/** Доставка письма по данным центра уведомлений. */
export enum GreetingDeliveryState {
  /** Письмо ждёт отправки или отправляется. */
  PENDING = 'pending',
  /** Письмо передано почтовому провайдеру. */
  DELIVERED = 'delivered',
  /** Попытки исчерпаны или отправка отменена. */
  FAILED = 'failed',
}

/** Почему поздравление не отправлено. */
export enum GreetingSkipReason {
  /** На дату нет действующего шаблона. */
  NO_TEMPLATE = 'no_template',
  /** Пайщик не действующий: вступление не завершено либо членство прекращено. */
  NOT_ACTIVE = 'not_active',
  /** У пайщика нет подписки в центре уведомлений или почты. */
  NO_RECIPIENT = 'no_recipient',
}

/**
 * Переменная шаблона. Значение перечня — служебное имя; в тексте шаблона
 * председатель пишет русское слово из словаря расширения (`{{Имя}}`).
 */
export enum GreetingVariable {
  LAST_NAME = 'lastName',
  FIRST_NAME = 'firstName',
  MIDDLE_NAME = 'middleName',
  /** Имя и отчество; без отчества — только имя. */
  ADDRESS = 'address',
  /** «35 лет». */
  AGE = 'age',
  /** «35-летием» — для фразы «поздравляем с 35-летием». */
  ANNIVERSARY = 'anniversary',
  COOPERATIVE = 'cooperative',
  CHAIRMAN = 'chairman',
}

/** Тип субъекта, которого поздравляет приложение: у организации даты рождения нет. */
export enum GreetingAccountType {
  INDIVIDUAL = 'individual',
  ENTREPRENEUR = 'entrepreneur',
}
