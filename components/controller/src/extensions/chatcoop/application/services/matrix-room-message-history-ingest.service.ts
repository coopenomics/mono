import { Injectable, Inject, Logger } from '@nestjs/common';
import { MatrixApiService, MatrixRoomTimelineEvent } from './matrix-api.service';
import { WhisperSttService } from './whisper-stt.service';
import { MATRIX_USER_REPOSITORY, MatrixUserRepository } from '../../domain/repositories/matrix-user.repository';
import {
  ROOM_MESSAGE_HISTORY_REPOSITORY,
  RoomMessageHistoryRepository,
} from '../../domain/repositories/room-message-history.repository';
import { ChatcoopRoomMessageKind } from '../../domain/entities/room-message-history.entity';

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function record(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function audioFilenameFromMimetype(mime: string | null, fallbackName: string | null): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('ogg')) {
    return 'voice.ogg';
  }
  if (m.includes('webm')) {
    return 'voice.webm';
  }
  if (m.includes('mpeg') || m.includes('mp3')) {
    return 'voice.mp3';
  }
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) {
    return 'voice.m4a';
  }
  if (fallbackName && /\.[a-z0-9]+$/i.test(fallbackName)) {
    return fallbackName.replace(/[^\w.-]/g, '_');
  }
  return 'voice.bin';
}

export interface IngestRoomMessagesOptions {
  /** Страниц «с головы» (from пустой) за тик — новые сообщения. */
  maxHeadPages?: number;
  /** @deprecated см. maxHeadPages */
  maxPages?: number;
  /** Страниц backfill за тик из PG-курсора (к старым событиям). */
  maxBackfillPages?: number;
  /** Столько подряд страниц без новых вставок — прекращаем пагинацию вглубь истории (только голова). */
  abortAfterConsecutivePagesWithoutInserts?: number;
}

/** Состояние курсора /messages из реестра managed rooms (PG). */
export type MatrixRoomMessageIngestCursorState = {
  paginationToken: string | null;
  backfillComplete: boolean;
};

export interface MatrixRoomHistoryIngestTickResult {
  inserted: number;
  skippedDuplicates: number;
  nextPaginationToken: string | null;
  backfillComplete: boolean;
}

export type MatrixRoomMessageSessionContext = {
  callTranscriptionId: string;
  livekitRoomName: string;
};

/**
 * Сохраняет в PG историю незашифрованной Matrix-комнаты: текстовые сообщения и голосовые (через Whisper → только текст).
 * Вызывается cron’ом независимо от звонков; опционально можно передать контекст сессии транскрипции.
 */
@Injectable()
export class MatrixRoomMessageHistoryIngestService {
  private readonly logger = new Logger(MatrixRoomMessageHistoryIngestService.name);
  private static readonly PAGE_LIMIT = 100;
  /** Сколько живёт запомненное отображаемое имя: имена меняются редко. */
  private static readonly DISPLAY_NAME_TTL_MS = 24 * 60 * 60 * 1000;

  /**
   * Отображаемые имена пользователей Matrix — общие для всех комнат и проходов.
   * Кэш жил один проход по одной комнате, и на каждое сообщение имя заново
   * спрашивалось у Synapse: 750 тыс. запросов в неделю с одного узла, две трети
   * журнала сервера чата (73B-18, У1).
   */
  private readonly displayNames = new Map<string, { name: string; storedAt: number }>();

  constructor(
    private readonly matrixApi: MatrixApiService,
    private readonly whisper: WhisperSttService,
    @Inject(MATRIX_USER_REPOSITORY) private readonly matrixUserRepository: MatrixUserRepository,
    @Inject(ROOM_MESSAGE_HISTORY_REPOSITORY) private readonly historyRepository: RoomMessageHistoryRepository
  ) {}

  async ingestRoomMessages(
    matrixRoomId: string,
    accessToken: string,
    session: MatrixRoomMessageSessionContext | null,
    ingestState: MatrixRoomMessageIngestCursorState,
    options?: IngestRoomMessagesOptions
  ): Promise<MatrixRoomHistoryIngestTickResult> {
    const maxHeadPages = options?.maxHeadPages ?? options?.maxPages ?? 6;
    const maxBackfillPages = options?.maxBackfillPages ?? 1;
    const abortAfterEmpty = options?.abortAfterConsecutivePagesWithoutInserts ?? 2;

    const displayCache = new Map<string, string>();
    const coopCache = new Map<string, string | null>();

    const head = await this.ingestPagesFrom(
      matrixRoomId,
      accessToken,
      session,
      { displayCache, coopCache },
      undefined,
      maxHeadPages,
      abortAfterEmpty
    );
    if (head.abortedByFetch) {
      return {
        inserted: head.inserted,
        skippedDuplicates: head.skippedDuplicates,
        nextPaginationToken: ingestState.paginationToken,
        backfillComplete: ingestState.backfillComplete,
      };
    }

    let inserted = head.inserted;
    let skippedDuplicates = head.skippedDuplicates;
    let nextToken: string | null = ingestState.paginationToken;
    let backfillComplete = ingestState.backfillComplete;

    if (!backfillComplete) {
      if (head.sawEmptyFirstChunk) {
        nextToken = null;
        backfillComplete = true;
      } else if (!nextToken) {
        nextToken = head.deepestEndToken;
        if (!nextToken) {
          backfillComplete = true;
        }
      } else {
        const bf = await this.ingestPagesFrom(
          matrixRoomId,
          accessToken,
          session,
          { displayCache, coopCache },
          nextToken,
          maxBackfillPages,
          undefined
        );
        if (bf.abortedByFetch) {
          return {
            inserted,
            skippedDuplicates,
            nextPaginationToken: ingestState.paginationToken,
            backfillComplete: ingestState.backfillComplete,
          };
        }
        inserted += bf.inserted;
        skippedDuplicates += bf.skippedDuplicates;
        if (bf.sawEmptyFirstChunk || !bf.deepestEndToken) {
          nextToken = null;
          backfillComplete = true;
        } else {
          nextToken = bf.deepestEndToken;
        }
      }
    } else {
      nextToken = null;
    }

    if (inserted > 0) {
      this.logger.log(
        `Инжест истории Matrix: room=${matrixRoomId}, новых=${inserted}, уже в БД=${skippedDuplicates}`
      );
    }

    return {
      inserted,
      skippedDuplicates,
      nextPaginationToken: backfillComplete ? null : nextToken,
      backfillComplete,
    };
  }

  private async ingestPagesFrom(
    matrixRoomId: string,
    accessToken: string,
    session: MatrixRoomMessageSessionContext | null,
    caches: {
      displayCache: Map<string, string>;
      coopCache: Map<string, string | null>;
    },
    startFrom: string | undefined,
    maxPages: number,
    abortAfterConsecutivePagesWithoutInserts: number | undefined
  ): Promise<{
    inserted: number;
    skippedDuplicates: number;
    deepestEndToken: string | null;
    sawEmptyFirstChunk: boolean;
    abortedByFetch: boolean;
  }> {
    const callTranscriptionId = session?.callTranscriptionId ?? null;
    const livekitRoomName = session?.livekitRoomName ?? null;

    let inserted = 0;
    let skippedDuplicates = 0;
    let fromToken: string | undefined = startFrom;
    let pages = 0;
    let consecutivePagesWithoutInserts = 0;
    let deepestEndToken: string | null = null;
    let sawEmptyFirstChunk = false;

    while (pages < maxPages) {
      pages += 1;
      let page;
      try {
        page = await this.matrixApi.fetchRoomMessagesPage(matrixRoomId, accessToken, {
          dir: 'b',
          from: fromToken,
          limit: MatrixRoomMessageHistoryIngestService.PAGE_LIMIT,
        });
      } catch (e) {
        this.logger.warn(`Чтение истории Matrix ${matrixRoomId} остановлено: ${String(e)}`);
        return {
          inserted,
          skippedDuplicates,
          deepestEndToken,
          sawEmptyFirstChunk,
          abortedByFetch: true,
        };
      }

      if (!page.chunk.length) {
        if (pages === 1) {
          sawEmptyFirstChunk = true;
        }
        break;
      }

      let pageInserted = 0;
      for (const ev of page.chunk) {
        const r = await this.processEvent(ev, {
          matrixRoomId,
          callTranscriptionId,
          livekitRoomName,
          accessToken,
          displayCache: caches.displayCache,
          coopCache: caches.coopCache,
        });
        if (r === 'inserted') {
          inserted += 1;
          pageInserted += 1;
        }
        if (r === 'duplicate') {
          skippedDuplicates += 1;
        }
      }

      if (typeof page.end === 'string' && page.end.length > 0) {
        deepestEndToken = page.end;
      }

      if (abortAfterConsecutivePagesWithoutInserts != null) {
        if (pageInserted === 0) {
          consecutivePagesWithoutInserts += 1;
          if (consecutivePagesWithoutInserts >= abortAfterConsecutivePagesWithoutInserts) {
            break;
          }
        } else {
          consecutivePagesWithoutInserts = 0;
        }
      }

      const next = page.end;
      if (!next || next === fromToken) {
        break;
      }
      fromToken = next;
    }

    if (pages >= maxPages) {
      this.logger.warn(`Инжест ${matrixRoomId}: достигнут лимит страниц (${maxPages})`);
    }

    return {
      inserted,
      skippedDuplicates,
      deepestEndToken,
      sawEmptyFirstChunk,
      abortedByFetch: false,
    };
  }

  private async resolveCoopUsernameCached(
    sender: string,
    coopCache: Map<string, string | null>
  ): Promise<string | null> {
    if (coopCache.has(sender)) {
      return coopCache.get(sender) ?? null;
    }
    const linked = await this.matrixUserRepository.findByMatrixUserId(sender);
    const c = linked?.coopUsername ?? null;
    coopCache.set(sender, c);
    return c;
  }

  private async resolveDisplayCached(
    sender: string,
    displayCache: Map<string, string>
  ): Promise<string> {
    const hit = displayCache.get(sender);
    if (hit) {
      return hit;
    }
    const remembered = this.displayNames.get(sender);
    if (remembered && Date.now() - remembered.storedAt < MatrixRoomMessageHistoryIngestService.DISPLAY_NAME_TTL_MS) {
      displayCache.set(sender, remembered.name);
      return remembered.name;
    }
    const dn = await this.matrixApi.resolveMatrixUserDisplayName(sender);
    displayCache.set(sender, dn);
    // Без ответа Synapse приходит запасной вариант — локальная часть адреса.
    // Его на сутки не запоминаем: иначе сбой сервера чата заморозил бы имя.
    const localPart = sender.startsWith('@') ? sender.slice(1).split(':')[0] : sender;
    if (dn !== localPart && dn !== sender) {
      this.displayNames.set(sender, { name: dn, storedAt: Date.now() });
    }
    return dn;
  }

  private async processEvent(
    ev: MatrixRoomTimelineEvent,
    ctx: {
      matrixRoomId: string;
      callTranscriptionId: string | null;
      livekitRoomName: string | null;
      accessToken: string;
      displayCache: Map<string, string>;
      coopCache: Map<string, string | null>;
    }
  ): Promise<'inserted' | 'duplicate' | 'ignored'> {
    if (ev.type === 'm.room.redaction') {
      return 'ignored';
    }
    if (ev.type !== 'm.room.message') {
      return 'ignored';
    }

    const eventId = str(ev.event_id);
    if (!eventId) {
      return 'ignored';
    }

    const sender = str(ev.sender);
    if (!sender) {
      return 'ignored';
    }

    const ts =
      typeof ev.origin_server_ts === 'number' && Number.isFinite(ev.origin_server_ts)
        ? ev.origin_server_ts
        : 0;

    const unsigned = record(ev.unsigned);
    if (unsigned?.redacted_because) {
      return 'ignored';
    }

    const content = record(ev.content);
    if (!content) {
      return 'ignored';
    }
    if (content.algorithm != null && typeof content.algorithm === 'string') {
      return 'ignored';
    }

    const msgtype = str(content.msgtype);
    if (!msgtype) {
      return 'ignored';
    }

    const coopUsername = await this.resolveCoopUsernameCached(sender, ctx.coopCache);
    const displayName = await this.resolveDisplayCached(sender, ctx.displayCache);

    if (msgtype === 'm.text' || msgtype === 'm.notice' || msgtype === 'm.emote') {
      const body = str(content.body)?.trim() ?? '';
      if (!body) {
        return 'ignored';
      }
      const saved = await this.historyRepository.insertIgnoreDuplicate({
        matrixRoomId: ctx.matrixRoomId,
        matrixEventId: eventId,
        callTranscriptionId: ctx.callTranscriptionId,
        livekitRoomName: ctx.livekitRoomName,
        senderMatrixUserId: sender,
        senderDisplayName: displayName,
        coopUsername,
        messageKind: ChatcoopRoomMessageKind.TEXT,
        bodyText: body,
        originServerTs: ts,
      });
      return saved ? 'inserted' : 'duplicate';
    }

    if (msgtype === 'm.audio') {
      const url = str(content.url);
      if (!url) {
        return 'ignored';
      }
      if (await this.historyRepository.existsByMatrixRoomAndEventId(ctx.matrixRoomId, eventId)) {
        return 'duplicate';
      }
      if (!this.whisper.isConfigured()) {
        this.logger.warn('Whisper не настроен — голосовое сообщение пропущено');
        return 'ignored';
      }
      const buf = await this.matrixApi.downloadMxcAsBuffer(url, ctx.accessToken);
      if (!buf || buf.length === 0) {
        return 'ignored';
      }
      const info = record(content.info);
      const mime = info ? str(info.mimetype) : null;
      const fname = str(content.filename);
      const whisperName = audioFilenameFromMimetype(mime, fname);
      const sttCtx = `matrix_history_ingest room=${ctx.matrixRoomId} event=${eventId} sender=${sender} msgtype=${msgtype}`;
      const stt = await this.whisper.transcribeMediaFile(buf, whisperName, undefined, sttCtx);
      if (stt.markMatrixEventSttFailed) {
        const savedFail = await this.historyRepository.insertIgnoreDuplicate({
          matrixRoomId: ctx.matrixRoomId,
          matrixEventId: eventId,
          callTranscriptionId: ctx.callTranscriptionId,
          livekitRoomName: ctx.livekitRoomName,
          senderMatrixUserId: sender,
          senderDisplayName: displayName,
          coopUsername,
          messageKind: ChatcoopRoomMessageKind.AUDIO_STT_FAIL,
          bodyText: '',
          originServerTs: ts,
        });
        return savedFail ? 'inserted' : 'duplicate';
      }
      const trimmed = stt.text.trim();
      if (!trimmed) {
        return 'ignored';
      }
      const saved = await this.historyRepository.insertIgnoreDuplicate({
        matrixRoomId: ctx.matrixRoomId,
        matrixEventId: eventId,
        callTranscriptionId: ctx.callTranscriptionId,
        livekitRoomName: ctx.livekitRoomName,
        senderMatrixUserId: sender,
        senderDisplayName: displayName,
        coopUsername,
        messageKind: ChatcoopRoomMessageKind.AUDIO,
        bodyText: trimmed,
        originServerTs: ts,
      });
      return saved ? 'inserted' : 'duplicate';
    }

    if (msgtype === 'm.file') {
      const info = record(content.info);
      const mime = info ? str(info.mimetype) : null;
      if (!mime || !mime.toLowerCase().startsWith('audio/')) {
        return 'ignored';
      }
      const url = str(content.url);
      if (!url) {
        return 'ignored';
      }
      if (await this.historyRepository.existsByMatrixRoomAndEventId(ctx.matrixRoomId, eventId)) {
        return 'duplicate';
      }
      if (!this.whisper.isConfigured()) {
        return 'ignored';
      }
      const buf = await this.matrixApi.downloadMxcAsBuffer(url, ctx.accessToken);
      if (!buf || buf.length === 0) {
        return 'ignored';
      }
      const fname = str(content.filename);
      const whisperName = audioFilenameFromMimetype(mime, fname);
      const sttCtx = `matrix_history_ingest room=${ctx.matrixRoomId} event=${eventId} sender=${sender} msgtype=${msgtype}`;
      const stt = await this.whisper.transcribeMediaFile(buf, whisperName, undefined, sttCtx);
      if (stt.markMatrixEventSttFailed) {
        const savedFail = await this.historyRepository.insertIgnoreDuplicate({
          matrixRoomId: ctx.matrixRoomId,
          matrixEventId: eventId,
          callTranscriptionId: ctx.callTranscriptionId,
          livekitRoomName: ctx.livekitRoomName,
          senderMatrixUserId: sender,
          senderDisplayName: displayName,
          coopUsername,
          messageKind: ChatcoopRoomMessageKind.AUDIO_STT_FAIL,
          bodyText: '',
          originServerTs: ts,
        });
        return savedFail ? 'inserted' : 'duplicate';
      }
      const trimmed = stt.text.trim();
      if (!trimmed) {
        return 'ignored';
      }
      const saved = await this.historyRepository.insertIgnoreDuplicate({
        matrixRoomId: ctx.matrixRoomId,
        matrixEventId: eventId,
        callTranscriptionId: ctx.callTranscriptionId,
        livekitRoomName: ctx.livekitRoomName,
        senderMatrixUserId: sender,
        senderDisplayName: displayName,
        coopUsername,
        messageKind: ChatcoopRoomMessageKind.AUDIO,
        bodyText: trimmed,
        originServerTs: ts,
      });
      return saved ? 'inserted' : 'duplicate';
    }

    return 'ignored';
  }
}
