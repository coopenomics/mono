// infrastructure/events/events.service.ts

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Сервис внутренней шины событий для блокчейн операций
 * Позволяет сервисам подписываться на события без прямых зависимостей
 */
@Injectable()
export class EventsService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Универсальный метод для публикации события с любым именем
   */
  emit(eventName: string, data: any): void {
    this.eventEmitter.emit(eventName, data);
  }

  /**
   * Публикация с ожиданием завершения всех async-обработчиков.
   * В отличие от emit (fire-and-forget) дожидается, пока @OnEvent-листенеры
   * (в т.ч. async) отработают. Если любой обработчик бросает — промис
   * отклоняется (ошибку не глотаем).
   */
  async emitAsync(eventName: string, data: any): Promise<unknown[]> {
    return this.eventEmitter.emitAsync(eventName, data);
  }

  /**
   * Барьер: публикация с ожиданием обработчиков, но не дольше timeoutMs.
   * Возвращает true, если все обработчики завершились в срок; false — если
   * сработал TTL force-resume (какой-то обработчик завис). Используется для
   * обработки форка: дождаться откатов до продолжения consumer'а, но не
   * блокировать поток навсегда из-за зависшего синкера (Story 1.3).
   */
  async emitAsyncWithTimeout(eventName: string, data: any, timeoutMs: number): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    try {
      const settled = this.eventEmitter.emitAsync(eventName, data).then(() => true);
      return await Promise.race([settled, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
