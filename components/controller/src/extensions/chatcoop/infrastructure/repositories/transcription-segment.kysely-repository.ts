import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, camelRow } from '@coopenomics/extension-kit';
import { TranscriptionSegmentRepository } from '../../domain/repositories/transcription-segment.repository';
import { TranscriptionSegmentDomainEntity } from '../../domain/entities/transcription-segment.entity';
import { ChatcoopLiveFeedService } from '../realtime/chatcoop-live-feed.service';
import type { DB } from '../database/chatcoop.database.types';

type NewSegment = Omit<TranscriptionSegmentDomainEntity, 'id' | 'createdAt'>;

const toRow = (segment: NewSegment) => ({
  transcription_id: segment.transcriptionId,
  speaker_identity: segment.speakerIdentity,
  speaker_name: segment.speakerName,
  text: segment.text,
  start_offset: segment.startOffset,
  end_offset: segment.endOffset,
});

/** Фрагменты расшифровки звонка (таблица `chatcoop_transcription_segments`). */
@Injectable()
export class TranscriptionSegmentKyselyRepository implements TranscriptionSegmentRepository {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    // Участникам звонка сигнал о новом фрагменте шлёт лента транскрипций.
    @Optional() @Inject(ChatcoopLiveFeedService) private readonly live: ChatcoopLiveFeedService | null = null
  ) {}

  async create(data: NewSegment): Promise<TranscriptionSegmentDomainEntity> {
    const [created] = await this.createMany([data]);
    return created;
  }

  /** Фрагменты транскрипции по времени начала. */
  async findByTranscriptionId(transcriptionId: string): Promise<TranscriptionSegmentDomainEntity[]> {
    const rows = await this.db
      .selectFrom('chatcoop_transcription_segments')
      .selectAll()
      .where('transcription_id', '=', transcriptionId)
      .orderBy('start_offset', 'asc')
      .execute();
    return rows.map((row) => camelRow<TranscriptionSegmentDomainEntity>(row));
  }

  async findById(id: string): Promise<TranscriptionSegmentDomainEntity | null> {
    const row = await this.db.selectFrom('chatcoop_transcription_segments').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? camelRow<TranscriptionSegmentDomainEntity>(row) : null;
  }

  async createMany(data: NewSegment[]): Promise<TranscriptionSegmentDomainEntity[]> {
    if (data.length === 0) return [];
    const rows = await this.db.insertInto('chatcoop_transcription_segments').values(data.map(toRow)).returningAll().execute();
    for (const id of new Set(rows.map((row) => row.transcription_id))) void this.live?.publishTranscription(id);
    return rows.map((row) => camelRow<TranscriptionSegmentDomainEntity>(row));
  }
}
