import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallTranscriptionRepository } from '../../domain/repositories/call-transcription.repository';
import { CallTranscriptionDomainEntity, TranscriptionStatus } from '../../domain/entities/call-transcription.entity';
import { CallTranscriptionTypeormEntity } from '../entities/call-transcription.typeorm-entity';
import { CallTranscriptionMapper } from '../mappers/call-transcription.mapper';
import { ChatcoopLiveFeedService } from '../realtime/chatcoop-live-feed.service';

// TypeORM адаптер репозитория транскрипций звонков
@Injectable()
export class CallTranscriptionTypeormRepository implements CallTranscriptionRepository {
  constructor(
    @InjectRepository(CallTranscriptionTypeormEntity)
    private readonly repository: Repository<CallTranscriptionTypeormEntity>,
    // Участникам звонка сигнал ленты шлётся отсюда: владельцы транскрипции —
    // имена пайщиков, а в строке хранятся идентификаторы Matrix.
    @Optional() @Inject(ChatcoopLiveFeedService) private readonly live: ChatcoopLiveFeedService | null = null
  ) {}

  async create(
    data: Omit<CallTranscriptionDomainEntity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CallTranscriptionDomainEntity> {
    const entity = this.repository.create(CallTranscriptionMapper.toEntity(data));
    const savedEntity = await this.repository.save(entity);
    void this.live?.publishTranscription(savedEntity.id);
    return CallTranscriptionMapper.toDomain(savedEntity);
  }

  async findById(id: string): Promise<CallTranscriptionDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? CallTranscriptionMapper.toDomain(entity) : null;
  }

  async findByRoomId(roomId: string): Promise<CallTranscriptionDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { roomId } });
    return entity ? CallTranscriptionMapper.toDomain(entity) : null;
  }

  async findByMatrixRoomId(matrixRoomId: string): Promise<CallTranscriptionDomainEntity[]> {
    const entities = await this.repository.find({
      where: { matrixRoomId },
      order: { createdAt: 'DESC' },
    });
    return entities.map(CallTranscriptionMapper.toDomain);
  }

  async findActiveByRoomId(roomId: string): Promise<CallTranscriptionDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { roomId, status: TranscriptionStatus.ACTIVE },
    });
    return entity ? CallTranscriptionMapper.toDomain(entity) : null;
  }

  async update(id: string, data: Partial<CallTranscriptionDomainEntity>): Promise<CallTranscriptionDomainEntity> {
    const updateData = CallTranscriptionMapper.toUpdateEntity(data);
    await this.repository.update(id, updateData);

    const updatedEntity = await this.repository.findOne({ where: { id } });
    if (!updatedEntity) {
      throw new Error('Call transcription not found after update');
    }
    void this.live?.publishTranscription(id);

    return CallTranscriptionMapper.toDomain(updatedEntity);
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<CallTranscriptionDomainEntity[]> {
    const entities = await this.repository.find({
      order: { createdAt: 'DESC' },
      take: options?.limit,
      skip: options?.offset,
    });
    return entities.map(CallTranscriptionMapper.toDomain);
  }

  async findCompletedByMatrixRoomIdsEndedAfter(
    matrixRoomIds: string[],
    endedAfterExclusive: Date
  ): Promise<CallTranscriptionDomainEntity[]> {
    if (matrixRoomIds.length === 0) {
      return [];
    }
    const entities = await this.repository
      .createQueryBuilder('ct')
      .where('ct.status = :status', { status: TranscriptionStatus.COMPLETED })
      .andWhere('ct.matrixRoomId IN (:...ids)', { ids: matrixRoomIds })
      .andWhere('ct.endedAt > :after', { after: endedAfterExclusive })
      .orderBy('ct.endedAt', 'ASC')
      .getMany();
    return entities.map(CallTranscriptionMapper.toDomain);
  }

  async getMaxCompletedEndedAtForRooms(matrixRoomIds: string[]): Promise<Date | null> {
    if (matrixRoomIds.length === 0) {
      return null;
    }
    const row = await this.repository
      .createQueryBuilder('ct')
      .select('MAX(ct.endedAt)', 'm')
      .where('ct.status = :status', { status: TranscriptionStatus.COMPLETED })
      .andWhere('ct.matrixRoomId IN (:...ids)', { ids: matrixRoomIds })
      .getRawOne<{ m: Date | null }>();
    return row?.m ?? null;
  }

  async findByParticipant(canonicalMatrixUserId: string): Promise<CallTranscriptionDomainEntity[]> {
    // Совпадение по каноническому MXID или по строке с суффиксом сессии (@user:server:suffix)
    const withSuffixPattern = `${canonicalMatrixUserId}:%`;
    const entities = await this.repository
      .createQueryBuilder('ct')
      .where(
        `EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(ct.participants) AS elem
          WHERE elem = :canonical OR elem LIKE :withSuffix
        )`,
        { canonical: canonicalMatrixUserId, withSuffix: withSuffixPattern }
      )
      .orderBy('ct.created_at', 'DESC')
      .getMany();

    return entities.map(CallTranscriptionMapper.toDomain);
  }
}
