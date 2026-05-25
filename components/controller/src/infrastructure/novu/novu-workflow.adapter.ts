import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import config from '~/config/config';
import type { NovuWorkflowPort } from '~/domain/notification/interfaces/novu-workflow.port';
import type {
  WorkflowTriggerDomainInterface,
  WorkflowTriggerResultDomainInterface,
} from '~/domain/notification/interfaces/workflow-trigger-domain.interface';

/**
 * Адаптер для работы с NOVU workflow trigger
 * Реализует отправку уведомлений через NOVU API
 */
@Injectable()
export class NovuWorkflowAdapter implements NovuWorkflowPort {
  private readonly logger = new Logger(NovuWorkflowAdapter.name);
  private readonly novuBaseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = config.novu.api_key;

    // Настраиваем базовый URL для NOVU API
    let baseUrl = config.novu.backend_url;
    if (!baseUrl.endsWith('/v1')) {
      baseUrl = baseUrl.replace(/\/+$/, '') + '/v1';
    }
    this.novuBaseUrl = baseUrl;

    this.logger.log(`NOVU Workflow адаптер инициализирован. URL: ${this.novuBaseUrl}`);
  }

  /**
   * Запустить воркфлоу для отправки уведомления
   * @param triggerData Данные для запуска воркфлоу
   * @returns Promise<WorkflowTriggerResultDomainInterface>
   */
  async triggerWorkflow(triggerData: WorkflowTriggerDomainInterface): Promise<WorkflowTriggerResultDomainInterface> {
    this.logger.log(`Запуск воркфлоу: ${triggerData.name}`);

    try {
      // Убираем кавычки из строк payload — иначе в теме письма Novu могли появляться буквальные &quot;
      const sanitizedTriggerData = {
        ...triggerData,
        payload: this.sanitizePayload(triggerData.payload),
      };

      const response: AxiosResponse = await axios.post(`${this.novuBaseUrl}/events/trigger`, sanitizedTriggerData, {
        headers: this.getHeaders(),
      });

      this.logger.log(`Воркфлоу запущен: ${triggerData.name}, transactionId: ${response.data.transactionId}`);

      return this.mapToTriggerResult(response.data);
    } catch (error: any) {
      const status = error.response?.status;
      const body =
        error.response?.data !== undefined ? JSON.stringify(error.response.data) : undefined;
      this.logger.error(
        `Ошибка запуска воркфлоу ${triggerData.name}: ${error.message}`
          + (status !== undefined ? ` [HTTP ${status}]` : '')
          + (body !== undefined ? ` body=${body}` : ''),
        error.stack
      );
      throw error;
    }
  }

  /**
   * Отменить триггер воркфлоу
   * @param transactionId ID транзакции для отмены
   * @returns Promise<boolean>
   */
  async cancelTriggeredWorkflow(transactionId: string): Promise<boolean> {
    this.logger.log(`Отмена воркфлоу: ${transactionId}`);

    try {
      await axios.delete(`${this.novuBaseUrl}/events/trigger/${transactionId}`, {
        headers: this.getHeaders(),
      });

      this.logger.log(`Воркфлоу отменен: ${transactionId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Ошибка отмены воркфлоу ${transactionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Получить статус выполнения воркфлоу
   * @param transactionId ID транзакции
   * @returns Promise<any>
   */
  async getWorkflowStatus(transactionId: string): Promise<any> {
    this.logger.debug(`Получение статуса воркфлоу: ${transactionId}`);

    try {
      const response: AxiosResponse = await axios.get(`${this.novuBaseUrl}/events/trigger/${transactionId}`, {
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(`Ошибка получения статуса воркфлоу ${transactionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Удаляет кавычки из строковых полей payload перед отправкой в Novu.
   * Раньше подставлялись HTML-сущности (&quot;), из‑за чего они буквально попадали в subject письма.
   */
  private sanitizePayload(payload: unknown): unknown {
    if (typeof payload === 'string') {
      return payload.replace(/["'\u201c\u201d\u201e\u00ab\u00bb]/g, '');
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.sanitizePayload(item));
    }

    if (payload !== null && typeof payload === 'object') {
      const source = payload as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};
      for (const key of Object.keys(source)) {
        sanitized[key] = this.sanitizePayload(source[key]);
      }
      return sanitized;
    }

    return payload;
  }

  /**
   * Возвращает заголовки для запросов к NOVU API
   */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `ApiKey ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Преобразует ответ NOVU API в доменный интерфейс результата
   * @param novuResponse Ответ от NOVU API
   * @returns WorkflowTriggerResultDomainInterface
   */
  private mapToTriggerResult(novuResponse: any): WorkflowTriggerResultDomainInterface {
    return {
      acknowledged: novuResponse.acknowledged || false,
      status: novuResponse.status || 'processed',
      error: novuResponse.error || undefined,
    };
  }
}
