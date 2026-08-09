import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import config from '~/config/config';
import type {
  InnerCalendarEventWindow,
  InnerCoopCalendarEventNotificationInput,
  ICoopCalendarEventNotificationPort,
  InnerCoopCalendarEventRead,
} from '@coopenomics/innercoop';
import { COOP_CALENDAR_EVENT_NOTIFICATION_PORT } from '@coopenomics/innercoop';
import type { ChatcoopManagedMatrixRoomRepository } from '../../domain/repositories/managed-matrix-room.repository';
import { CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY } from '../../domain/repositories/managed-matrix-room.repository';
import type { ChatCoopCalendarEventRepository } from '../../domain/repositories/calendar-event.repository';
import { CHATCOOP_CALENDAR_EVENT_REPOSITORY } from '../../domain/repositories/calendar-event.repository';
import type { ChatCoopCalendarIcsSubscriptionRepository } from '../../domain/repositories/calendar-ics-subscription.repository';
import { CHATCOOP_CALENDAR_ICS_SUBSCRIPTION_REPOSITORY } from '../../domain/repositories/calendar-ics-subscription.repository';
import type { ChatCoopCalendarEventDomainEntity } from '../../domain/entities/calendar-event.entity';
import { VARS_REPOSITORY, type VarsRepository } from '~/domain/common/repositories/vars.repository';

function sha256Hex(plain: string): string {
  return crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) {
      return false;
    }
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Форматирование даты для ICS в UTC (базовый формат DTSTART/DTEND). */
function formatIcsUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line: string): string {
  const max = 75;
  if (line.length <= max) {
    return line;
  }
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, max));
  rest = rest.slice(max);
  while (rest.length > 0) {
    const chunk = rest.slice(0, max - 1);
    parts.push(` ${chunk}`);
    rest = rest.slice(max - 1);
  }
  return parts.join('\r\n');
}

@Injectable()
export class ChatCoopCalendarApplicationService {
  constructor(
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedRooms: ChatcoopManagedMatrixRoomRepository,
    @Inject(CHATCOOP_CALENDAR_EVENT_REPOSITORY)
    private readonly events: ChatCoopCalendarEventRepository,
    @Inject(CHATCOOP_CALENDAR_ICS_SUBSCRIPTION_REPOSITORY)
    private readonly icsSubs: ChatCoopCalendarIcsSubscriptionRepository,
    @Inject(VARS_REPOSITORY)
    private readonly varsRepository: VarsRepository,
    @Inject(COOP_CALENDAR_EVENT_NOTIFICATION_PORT)
    private readonly calendarEventNotifications: ICoopCalendarEventNotificationPort
  ) {}

  async listPlaintextRoomsForPicker(): Promise<{ matrixRoomId: string; displayLabel: string }[]> {
    const rows = await this.managedRooms.findEligibleForSecretaryTranscription();
    return rows.map((r) => ({ matrixRoomId: r.matrixRoomId, displayLabel: r.displayLabel }));
  }

  async listEvents(): Promise<ChatCoopCalendarEventDomainEntity[]> {
    return this.events.listAll();
  }

  private async buildCalendarNotificationInput(
    ev: ChatCoopCalendarEventDomainEntity,
    actorUsername: string
  ): Promise<InnerCoopCalendarEventNotificationInput> {
    const room = await this.managedRooms.findByMatrixRoomId(ev.matrixRoomId);
    const roomDisplayLabel = room?.displayLabel ?? ev.matrixRoomId;
    const roomKind = room?.kind ?? 'members';
    const projectHash = roomKind === 'capital_project' ? room?.projectHash ?? null : null;
    const frontendBase = config.frontend_url.replace(/\/$/, '');
    const eventUrl = `${frontendBase}/#/${config.coopname}/chatcoop/chat?matrix_room=${encodeURIComponent(ev.matrixRoomId)}`;
    return {
      title: ev.title,
      description: ev.description,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      roomDisplayLabel,
      eventUrl,
      actorUsername: actorUsername.toLowerCase(),
      roomKind,
      projectHash,
    };
  }

  async assertPlaintextManagedRoom(matrixRoomId: string): Promise<void> {
    const room = await this.managedRooms.findByMatrixRoomId(matrixRoomId);
    if (!room || room.encrypted) {
      throw new Error('Комната не найдена в реестре или недоступна для календаря (только незашифрованные комнаты)');
    }
  }

  async createEvent(
    coopUsername: string,
    input: {
      matrixRoomId: string;
      title: string;
      description: string | null;
      startsAt: Date;
      endsAt: Date | null;
    }
  ): Promise<ChatCoopCalendarEventDomainEntity> {
    await this.assertPlaintextManagedRoom(input.matrixRoomId);
    const ev = await this.events.create({
      matrixRoomId: input.matrixRoomId,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdByUsername: coopUsername.toLowerCase(),
    });
    const notifyInput = await this.buildCalendarNotificationInput(ev, coopUsername);
    await this.calendarEventNotifications.notifyEventCreated(notifyInput);
    return ev;
  }

  async updateEvent(input: {
    id: string;
    matrixRoomId: string;
    title: string;
    description: string | null;
    startsAt: Date;
    endsAt: Date | null;
    updatedByUsername: string;
  }): Promise<ChatCoopCalendarEventDomainEntity> {
    await this.assertPlaintextManagedRoom(input.matrixRoomId);
    const ev = await this.events.update({
      id: input.id,
      matrixRoomId: input.matrixRoomId,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    const notifyInput = await this.buildCalendarNotificationInput(ev, input.updatedByUsername);
    await this.calendarEventNotifications.notifyEventUpdated(notifyInput);
    return ev;
  }

  async deleteEvent(id: string): Promise<void> {
    await this.events.deleteById(id);
  }

  /**
   * Создаёт или обновляет секрет подписки и возвращает полный URL ленты ICS (без JWT).
   */
  async createOrRotatePersonalIcsUrl(coopUsername: string): Promise<string> {
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const hash = sha256Hex(rawSecret);
    const sub = await this.icsSubs.rotateSecretForUser(coopUsername, hash);
    const apiBase = config.backend_url.replace(/\/$/, '');
    return `${apiBase}/v1/extensions/chatcoop/calendar/feed.ics?id=${encodeURIComponent(sub.id)}&secret=${encodeURIComponent(rawSecret)}`;
  }

  async buildIcsDocumentForSubscription(subscriptionId: string, rawSecret: string): Promise<string | null> {
    const sub = await this.icsSubs.findById(subscriptionId);
    if (!sub) {
      return null;
    }
    if (!timingSafeEqualHex(sub.secretSha256Hex, sha256Hex(rawSecret))) {
      return null;
    }
    const all = await this.events.listAll();
    const coopname = config.coopname;
    const vars = await this.varsRepository.get();
    // Как в Matrix-комнатах и display name: short_abbr + name из MongoDB vars
    const calendarDisplayName = vars ? `${vars.short_abbr} ${vars.name}` : coopname;
    const frontendBase = config.frontend_url.replace(/\/$/, '');
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Coopenomics//Cooperative Calendar//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      foldIcsLine(`X-WR-CALNAME:${escapeIcsText(calendarDisplayName)}`),
    ];
    const now = new Date();
    const stamp = formatIcsUtc(now);
    for (const ev of all) {
      const room = await this.managedRooms.findByMatrixRoomId(ev.matrixRoomId);
      const roomLabel = room?.displayLabel ?? ev.matrixRoomId;
      const deepLink = `${frontendBase}/#/${coopname}/chatcoop/chat?matrix_room=${encodeURIComponent(ev.matrixRoomId)}`;
      const descParts = [
        ev.description ? escapeIcsText(ev.description) : '',
        escapeIcsText(`Комната: ${roomLabel}`),
        escapeIcsText(`Стол связи: ${deepLink}`),
      ].filter((p) => p.length > 0);
      const description = descParts.join('\\n\\n');
      const end = ev.endsAt ?? new Date(ev.startsAt.getTime() + 60 * 60 * 1000);
      lines.push('BEGIN:VEVENT');
      lines.push(foldIcsLine(`UID:chatcoop-calendar-${ev.id}@${coopname}`));
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART:${formatIcsUtc(ev.startsAt)}`);
      lines.push(`DTEND:${formatIcsUtc(end)}`);
      lines.push(`SEQUENCE:${ev.icsSequence}`);
      lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(ev.title)}`));
      lines.push(foldIcsLine(`DESCRIPTION:${description}`));
      // Без VALARM; явно отключаем дефолтное напоминание клиента (часто «за 30 мин») в Apple Calendar.
      lines.push('X-APPLE-DEFAULT-ALARM-COMPONENTS:NONE');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
  }

  async listEventsForInterPort(
    projectHash: string,
    window?: InnerCalendarEventWindow
  ): Promise<InnerCoopCalendarEventRead[]> {
    const w =
      window !== undefined
        ? { from: new Date(window.fromInclusive), to: new Date(window.toExclusive) }
        : undefined;
    const list = await this.events.listByManagedRoomProjectHashes([projectHash], w);
    return list.map((ev) => ({
      id: ev.id,
      matrixRoomId: ev.matrixRoomId,
      projectHash,
      title: ev.title,
      description: ev.description,
      startsAtIso: ev.startsAt.toISOString(),
      endsAtIso: ev.endsAt ? ev.endsAt.toISOString() : null,
      createdByUsername: ev.createdByUsername,
      icsSequence: ev.icsSequence,
    }));
  }
}
