import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import config from '~/config/config';
import { NotificationPort, NotificationSubscriberData } from '~/domain/notification/interfaces/notification.port';

@Injectable()
export class NovuAdapter implements NotificationPort {
  private readonly logger = new Logger(NovuAdapter.name);
  private readonly novuBaseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = config.novu.api_key;

    // Настраиваем базовый URL для NOVU API
    let baseUrl = config.novu.backend_url;
    if (!baseUrl.endsWith('/v1/subscribers')) {
      baseUrl = baseUrl.replace(/\/+$/, '') + '/v1/subscribers';
    }
    this.novuBaseUrl = baseUrl;
    console.log('apiKey', this.apiKey, this.novuBaseUrl);
    this.logger.log(`NOVU адаптер инициализирован. URL: ${this.novuBaseUrl}`);
  }

  /**
   * Создает или обновляет подписчика в NOVU
   * @param subscriber Данные подписчика
   */
  async upsertSubscriber(subscriber: NotificationSubscriberData): Promise<void> {
    this.logger.log(`Upsert подписчика: ${subscriber.subscriberId}`);

    try {
      // Сначала пытаемся обновить существующего подписчика
      await this.updateSubscriber(subscriber);
      this.logger.log(`Подписчик обновлен: ${subscriber.subscriberId}`);
    } catch (error: any) {
      // Если подписчик не найден - создаем нового
      if (this.isNotFoundError(error)) {
        try {
          await this.createSubscriber(subscriber);
          this.logger.log(`Подписчик создан: ${subscriber.subscriberId}`);
        } catch (createError: any) {
          this.logger.error(
            `Ошибка создания подписчика ${subscriber.subscriberId}: ${createError.message}`,
            createError.stack
          );
          throw createError;
        }
      } else {
        this.logger.error(`Ошибка обновления подписчика ${subscriber.subscriberId}: ${error.message}`, error.stack);
        throw error;
      }
    }
  }

  /**
   * Получает подписчика по ID
   * @param subscriberId ID подписчика
   */
  async getSubscriber(subscriberId: string): Promise<NotificationSubscriberData | null> {
    try {
      const response: AxiosResponse = await axios.get(`${this.novuBaseUrl}/${subscriberId}`, {
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error: any) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      this.logger.error(`Ошибка получения подписчика ${subscriberId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Удаляет подписчика
   * @param subscriberId ID подписчика
   */
  async deleteSubscriber(subscriberId: string): Promise<void> {
    try {
      await axios.delete(`${this.novuBaseUrl}/${subscriberId}`, {
        headers: this.getHeaders(),
      });

      this.logger.log(`Подписчик удален: ${subscriberId}`);
    } catch (error: any) {
      if (!this.isNotFoundError(error)) {
        this.logger.error(`Ошибка удаления подписчика ${subscriberId}: ${error.message}`, error.stack);
        throw error;
      }
    }
  }

  /**
   * Обновляет существующего подписчика
   * @param subscriber Данные подписчика
   */
  private async updateSubscriber(subscriber: NotificationSubscriberData): Promise<void> {
    await axios.put(`${this.novuBaseUrl}/${subscriber.subscriberId}`, subscriber, {
      headers: this.getHeaders(),
    });
  }

  /**
   * Создает нового подписчика
   * @param subscriber Данные подписчика
   */
  private async createSubscriber(subscriber: NotificationSubscriberData): Promise<void> {
    await axios.post(this.novuBaseUrl, subscriber, {
      headers: this.getHeaders(),
    });
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
   * Проверяет, является ли ошибка "не найдено"
   * @param error Ошибка axios
   */
  private isNotFoundError(error: any): boolean {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || '';

    return (status === 400 || status === 404) && typeof message === 'string' && message.toLowerCase().includes('not found');
  }
}
