/**
 * Доменный интерфейс актора/получателя уведомления
 * Представляет данные для запуска воркфлоу уведомлений
 */
export interface WorkflowTriggerDomainInterface {
  /**
   * Имя воркфлоу для запуска
   */
  name: string;

  /**
   * Данные для воркфлоу (payload)
   */
  to: WorkflowRecipientDomainInterface | WorkflowRecipientDomainInterface[];

  /**
   * Данные для шаблона уведомления
   */
  payload?: Record<string, any>;

  /**
   * Дополнительные параметры
   */
  overrides?: Record<string, any>;

  /**
   * Идентификатор актора (кто инициировал уведомление)
   */
  actor?: WorkflowActorDomainInterface;

  /**
   * Идентификатор tenant (для мульти-тенантной)
   */
  tenant?: string;
}

/**
 * Доменный интерфейс для получателя уведомления
 */
export interface WorkflowRecipientDomainInterface {
  /**
   * ID подписчика
   */
  subscriberId: string;

  /**
   * Email получателя (опционально)
   */
  email?: string;

  /**
   * Имя получателя (опционально)
   */
  firstName?: string;

  /**
   * Фамилия получателя (опционально)
   */
  lastName?: string;

  /**
   * Дополнительные данные получателя
   */
  data?: Record<string, any>;
}

/**
 * Доменный интерфейс для актора уведомления
 */
export interface WorkflowActorDomainInterface {
  /**
   * ID актора
   */
  subscriberId: string;

  /**
   * Имя актора
   */
  firstName?: string;

  /**
   * Фамилия актора
   */
  lastName?: string;

  /**
   * Email актора
   */
  email?: string;

  /**
   * Дополнительные данные актора
   */
  data?: Record<string, any>;
}

/**
 * Доменный интерфейс для результата триггера воркфлоу
 */
export interface WorkflowTriggerResultDomainInterface {
  /**
   * Статус выполнения
   */
  acknowledged: boolean;

  /**
   * Статус операции
   */
  status: 'processed' | 'warning' | 'error';

  /**
   * Ошибка (если есть)
   */
  error?: string[];
}
