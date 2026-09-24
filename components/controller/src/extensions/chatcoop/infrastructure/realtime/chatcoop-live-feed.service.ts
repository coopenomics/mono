import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CHAIN_CHANGES_PORT, type IChainChangesPort } from '@coopenomics/innercoop';
import { CallTranscriptionTypeormEntity } from '../entities/call-transcription.typeorm-entity';
import { MatrixUserTypeormEntity } from '../entities/matrix-user.typeorm-entity';
import { canonicalizeMatrixUserId } from '../../domain/utils/matrix-user-id.util';

/** Код расширения «Чат кооператива» в ленте изменений. */
const CODE = 'chatcoop';

const TRANSCRIPTIONS_TABLE = 'chatcoop_call_transcriptions';

/**
 * Владельцы транскрипции в сигнале — участники звонка по именам пайщиков. В
 * строке такого поля нет (там идентификаторы Matrix), поэтому автоматический
 * сигнал подписчика базы уходит только совету, а участникам его шлёт
 * `publishTranscription`.
 */
const TRANSCRIPTION_OWNERS = 'participant_usernames';

/**
 * Чат кооператива в ленте изменений (C28-83). События календаря видят все
 * пайщики, управляемые комнаты — совет, учётную запись Matrix — её владелец,
 * транскрипцию — участники звонка и совет. Объявление — при старте модуля.
 */
@Injectable()
export class ChatcoopLiveFeedService implements OnModuleInit {
  constructor(
    @InjectRepository(CallTranscriptionTypeormEntity)
    private readonly transcriptions: Repository<CallTranscriptionTypeormEntity>,
    @InjectRepository(MatrixUserTypeormEntity)
    private readonly matrixUsers: Repository<MatrixUserTypeormEntity>,
    @Optional() @Inject(CHAIN_CHANGES_PORT) private readonly chainChanges: IChainChangesPort | null = null
  ) {}

  onModuleInit(): void {
    this.chainChanges?.declareLocalTables([
      { code: CODE, table: 'chatcoop_calendar_events' },
      { code: CODE, table: 'chatcoop_managed_matrix_rooms', staff_only: true },
      { code: CODE, table: TRANSCRIPTIONS_TABLE, owner_field: TRANSCRIPTION_OWNERS },
      { code: CODE, table: 'matrix_users', owner_field: 'coopUsername' },
    ]);
  }

  /**
   * Сигнал участникам звонка: транскрипция создана, дополнена фрагментом,
   * завершена или переименована. Участники хранятся идентификаторами Matrix —
   * имена пайщиков берутся из реестра учётных записей Matrix. Сбой ленты не
   * должен ронять запись расшифровки — ошибка глотается.
   */
  async publishTranscription(transcriptionId: string): Promise<void> {
    if (!this.chainChanges) return;
    try {
      const row = await this.transcriptions.findOne({ where: { id: transcriptionId } });
      if (!row) return;
      const ids = [...new Set((row.participants ?? []).map(canonicalizeMatrixUserId))];
      const users = ids.length ? await this.matrixUsers.find({ where: { matrixUserId: In(ids) } }) : [];
      await this.chainChanges.publishLocal(TRANSCRIPTIONS_TABLE, transcriptionId, {
        [TRANSCRIPTION_OWNERS]: users.map((u) => u.coopUsername),
      });
    } catch {
      // Сигнал — подсказка «перечитай», не данные: без него экран догонит дочиткой.
    }
  }
}
