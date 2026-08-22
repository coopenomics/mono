import type { InnerPage, InnerPageRequest } from './payment.port';

/**
 * Журнал изменений: кто, что и когда менял через интерфейс кооператива.
 *
 * Расширение показывает пайщику историю своих действий — но записывает её
 * ядро, единообразно для всего кооператива. Поэтому наружу отданы только
 * выборки: подделать чужую запись или дописать свою расширение не может.
 */

/** Запись журнала. */
export interface InnerMutationLogEntry {
  _id: string;
  coopname?: string;
  /** Имя операции, как она названа в интерфейсе. */
  mutation_name: string;
  /** Кто выполнил. */
  username: string;
  /** Аргументы вызова; состав зависит от операции. */
  arguments: Record<string, any>;
  duration_ms: number;
  status: 'success' | 'error';
  error_message?: string;
  created_at: Date;
  [key: string]: any;
}

export interface InnerMutationLogFilter {
  coopname?: string;
  username?: string;
  /** Отбор по именам операций: расширение показывает только свои. */
  mutation_names?: string[];
  date_from?: string | Date;
  date_to?: string | Date;
  status?: 'success' | 'error';
  [key: string]: any;
}

export interface IMutationLogPort {
  findAll(
    filter?: InnerMutationLogFilter,
    page?: InnerPageRequest
  ): Promise<InnerPage<InnerMutationLogEntry>>;

  /** Запись по идентификатору; `null`, если её нет. */
  findById(id: string): Promise<InnerMutationLogEntry | null>;
}

export const MUTATION_LOG_PORT = Symbol.for('Innercoop.CorePort.MutationLog');
