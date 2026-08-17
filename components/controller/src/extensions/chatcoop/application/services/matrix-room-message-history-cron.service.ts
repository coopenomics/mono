import cron from 'node-cron';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EXTENSION_REPOSITORY } from '@coopenomics/extension-kit';
import type { ExtensionDomainRepository } from '@coopenomics/extension-kit';
import { CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY } from '../../domain/repositories/managed-matrix-room.repository';
import type { ChatcoopManagedMatrixRoomRepository } from '../../domain/repositories/managed-matrix-room.repository';
import { ChatCoopSecretaryMatrixTokenService } from './chatcoop-secretary-matrix-token.service';
import { MatrixRoomMessageHistoryIngestService } from './matrix-room-message-history-ingest.service';

const CHATCOOP_EXTENSION_NAME = 'chatcoop';

interface ChatCoopConfigSyncSlice {
  messageHistorySyncIntervalMinutes?: number;
}

/**
 * Периодическая запись истории Matrix (текст + голос → текст) по незашифрованным комнатам реестра.
 * Не связана со звонками LiveKit.
 */
@Injectable()
export class MatrixRoomMessageHistoryCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatrixRoomMessageHistoryCronService.name);
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedRooms: ChatcoopManagedMatrixRoomRepository,
    private readonly secretaryToken: ChatCoopSecretaryMatrixTokenService,
    private readonly ingest: MatrixRoomMessageHistoryIngestService
  ) {}

  onModuleInit(): void {
    void this.scheduleFromConfig();
  }

  onModuleDestroy(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.log('Cron синхронизации истории Matrix остановлен');
    }
  }

  private async scheduleFromConfig(): Promise<void> {
    const ext = await this.extensionRepository.findByName(CHATCOOP_EXTENSION_NAME);
    const cfg = (ext?.config ?? {}) as ChatCoopConfigSyncSlice;
    const minutesRaw = cfg.messageHistorySyncIntervalMinutes;
    const minutes =
      typeof minutesRaw === 'number' && Number.isFinite(minutesRaw)
        ? Math.min(60, Math.max(1, Math.floor(minutesRaw)))
        : 2;
    const expression = minutes <= 1 ? '* * * * *' : `*/${minutes} * * * *`;

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.cronJob = cron.schedule(expression, () => {
      void this.runSyncTick();
    });
    this.logger.log(`Cron истории Matrix: каждые ${minutes} мин. (${expression})`);
    void this.runSyncTick();
  }

  /** Для тестов / ручного запуска */
  async runSyncTick(): Promise<void> {
    const token = await this.secretaryToken.getAccessToken();
    if (!token) {
      this.logger.debug('Синхронизация истории Matrix пропущена: нет токена секретаря');
      return;
    }

    let rooms;
    try {
      rooms = await this.managedRooms.findEligibleForSecretaryTranscription();
    } catch (e) {
      this.logger.warn(`Список комнат для истории Matrix: ${String(e)}`);
      return;
    }

    if (rooms.length === 0) {
      return;
    }

    for (const r of rooms) {
      try {
        const tick = await this.ingest.ingestRoomMessages(
          r.matrixRoomId,
          token,
          null,
          {
            paginationToken: r.messageHistoryPaginationToken ?? null,
            backfillComplete: r.messageHistoryBackfillComplete ?? false,
          },
          {
            maxHeadPages: 6,
            maxBackfillPages: 1,
            abortAfterConsecutivePagesWithoutInserts: 2,
          }
        );
        await this.managedRooms.updateMessageHistoryIngestState(r.matrixRoomId, {
          paginationToken: tick.nextPaginationToken,
          backfillComplete: tick.backfillComplete,
        });
      } catch (e) {
        this.logger.warn(`Инжест истории Matrix ${r.matrixRoomId}: ${String(e)}`);
      }
    }
  }
}
