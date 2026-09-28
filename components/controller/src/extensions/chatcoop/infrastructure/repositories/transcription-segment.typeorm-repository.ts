import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranscriptionSegmentRepository } from '../../domain/repositories/transcription-segment.repository';
import { TranscriptionSegmentDomainEntity } from '../../domain/entities/transcription-segment.entity';
import { TranscriptionSegmentTypeormEntity } from '../entities/transcription-segment.typeorm-entity';
import { TranscriptionSegmentMapper } from '../mappers/transcription-segment.mapper';
import { ChatcoopLiveFeedService } from '../realtime/chatcoop-live-feed.service';

// TypeORM адаптер репозитория сегментов транскрипции
@Injectable()
export class TranscriptionSegmentTypeormRepository implements TranscriptionSegmentRepository {
  constructor(
    @InjectRepository(TranscriptionSegmentTypeormEntity)
    private readonly repository: Repository<TranscriptionSegmentTypeormEntity>,
    // Новый фрагмент — изменение транскрипции: сигнал её участникам.
    @Optional() @Inject(ChatcoopLiveFeedService) private readonly live: ChatcoopLiveFeedService | null = null
  ) {}

  async create(
    data: Omit<TranscriptionSegmentDomainEntity, 'id' | 'createdAt'>
  ): Promise<TranscriptionSegmentDomainEntity> {
    const entity = this.repository.create(TranscriptionSegmentMapper.toEntity(data));
    const savedEntity = await this.repository.save(entity);
    void this.live?.publishTranscription(savedEntity.transcriptionId);
    return TranscriptionSegmentMapper.toDomain(savedEntity);
  }

  async findByTranscriptionId(transcriptionId: string): Promise<TranscriptionSegmentDomainEntity[]> {
    const entities = await this.repository.find({
      where: { transcriptionId },
      order: { startOffset: 'ASC' },
    });
    return entities.map(TranscriptionSegmentMapper.toDomain);
  }

  async findById(id: string): Promise<TranscriptionSegmentDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? TranscriptionSegmentMapper.toDomain(entity) : null;
  }

  async createMany(
    data: Omit<TranscriptionSegmentDomainEntity, 'id' | 'createdAt'>[]
  ): Promise<TranscriptionSegmentDomainEntity[]> {
    const entities = data.map((d) => this.repository.create(TranscriptionSegmentMapper.toEntity(d)));
    const savedEntities = await this.repository.save(entities);
    for (const id of new Set(savedEntities.map((e) => e.transcriptionId))) void this.live?.publishTranscription(id);
    return savedEntities.map(TranscriptionSegmentMapper.toDomain);
  }
}
