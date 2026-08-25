import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import {
  SUPPORT_TICKET_REPOSITORY,
  type SupportTicketRepository,
} from '../../domain/repositories/support-ticket.repository';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportMessageAuthorRole } from '../../domain/enums/support-message-author-role.enum';
import { SupportSystemEvent } from '../../domain/enums/support-system-event.enum';
import {
  SUPPORT_TICKET_AUTHOR_STATUS_CHANGED_EVENT,
  type SupportTicketAuthorStatusChangedEvent,
} from '../events/support-notification.events';

/**
 * Сколько часов обращение ждёт в статусе «решено», прежде чем закрыться.
 *
 * Значение из переменной окружения — константы в коде нет: порог задаёт
 * кооператив, а не сборка. По умолчанию 48 часов, верхняя граница
 * согласованного окна 24–48: смысл ожидания в том, чтобы пайщик успел
 * возразить, и меньшее значение урезает эту гарантию без нужды.
 * Подтверждено председателем 18.08.2026.
 */
const AUTO_CLOSE_HOURS = Number(process.env.SUPPORT_AUTO_CLOSE_HOURS) || 48;

/**
 * Как часто проверять кандидатов. Тик определяет только запаздывание закрытия
 * относительно порога, поэтому час здесь достаточно мелко: при пороге в двое
 * суток лишний час ожидания незаметен, а нагрузка на базу — одна выборка.
 */
const TICK_MS = Number(process.env.SUPPORT_AUTO_CLOSE_INTERVAL_MS) || 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Автозакрытие решённых обращений.
 *
 * Единственный путь обращения в статус «закрыто»: команды закрытия нет ни у
 * оператора, ни у председателя, ни у автора (спецификация, раздел 3).
 *
 * Гонка «таймер против сообщения автора» гасится не здесь, а в репозитории:
 * закрытие выполняется условным обновлением по статусу и отсчёту, и если автор
 * успел вернуть обращение в работу, обновление просто не найдёт строку. По той
 * же причине безопасен повторный тик — второй раз условие не выполнится.
 *
 * Своего порта таймеру не нужно: обращения закрываются тем же репозиторием,
 * а уведомление уходит обычным событием смены статуса с пустым инициатором.
 */
@Injectable()
export class SupportAutoCloseService implements OnModuleInit {
  /** Гард от наложения тиков: длинный прогон не запускается повторно. */
  private isRunning = false;

  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY) private readonly tickets: SupportTicketRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly events: EventEmitter2
  ) {
    this.logger.setContext(SupportAutoCloseService.name);
  }

  onModuleInit(): void {
    this.logger.log(
      `Автозакрытие обращений включено: порог ${AUTO_CLOSE_HOURS} ч, проверка каждые ${Math.round(TICK_MS / 60000)} мин`
    );
  }

  @Interval('support-ticket-auto-close', TICK_MS)
  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.closeExpired();
    } catch (error) {
      // Сбой прогона не должен гасить планировщик: следующий тик повторит
      // работу, а кандидаты никуда не денутся — они выбираются заново.
      this.logger.error(`Прогон автозакрытия прерван: ${(error as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async closeExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - AUTO_CLOSE_HOURS * HOUR_MS);
    const candidates = await this.tickets.findResolvedBefore(cutoff);
    if (candidates.length === 0) return;

    let closed = 0;
    let skipped = 0;

    for (const candidate of candidates) {
      const result = await this.tickets.closeIfStillResolved(candidate.id, cutoff, {
        message: {
          // Единственная запись ленты без автора: это действие самой системы,
          // человека за ним нет.
          authorUsername: null,
          authorRole: SupportMessageAuthorRole.SYSTEM,
          body: null,
          systemEvent: SupportSystemEvent.AUTO_CLOSED,
          payload: { threshold_hours: AUTO_CLOSE_HOURS },
        },
        attachments: [],
      });

      if (!result) {
        // Автор успел написать между выборкой и записью — обращение снова в
        // работе, закрывать нечего и уведомлять не о чем.
        skipped++;
        continue;
      }

      closed++;
      // Событие — после фиксации транзакции закрытия. Инициатор пуст: у
      // автозакрытия человека-инициатора нет, и слушатель поэтому отправит
      // уведомление всегда, не считая его «письмом о собственном действии».
      const payload: SupportTicketAuthorStatusChangedEvent = {
        coopname: result.ticket.coopname,
        ticket_id: result.ticket.id,
        message_id: result.message.id,
        ticket_number: result.ticket.number,
        subject: result.ticket.subject,
        previous_status: SupportTicketStatus.RESOLVED,
        status: result.ticket.status,
        initiator_username: null,
      };
      this.events.emit(SUPPORT_TICKET_AUTHOR_STATUS_CHANGED_EVENT, payload);
    }

    this.logger.log(
      `Автозакрытие: закрыто ${closed}, отложено ${skipped} из ${candidates.length} кандидатов (порог ${AUTO_CLOSE_HOURS} ч)`
    );
  }
}
