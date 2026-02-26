import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentRepository } from '../../domain/repositories/comment.repository';
import { CommentDomainEntity } from '../../domain/entities/comment.entity';
import { CommentTypeormEntity } from '../entities/comment.typeorm-entity';
import { CommentMapper } from '../mappers/comment.mapper';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';

@Injectable()
export class CommentTypeormRepository implements CommentRepository {
  constructor(
    @InjectRepository(CommentTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    private readonly commentTypeormRepository: Repository<CommentTypeormEntity>
  ) {}

  async create(comment: Omit<CommentDomainEntity, '_id'>): Promise<CommentDomainEntity> {
    const entity = this.commentTypeormRepository.create(CommentMapper.toEntity(comment));
    const savedEntity = await this.commentTypeormRepository.save(entity);
    return CommentMapper.toDomain(savedEntity);
  }

  async findById(_id: string): Promise<CommentDomainEntity | null> {
    const entity = await this.commentTypeormRepository.findOne({ where: { _id } });
    return entity ? CommentMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<CommentDomainEntity[]> {
    const entities = await this.commentTypeormRepository.find();
    return entities.map(CommentMapper.toDomain);
  }

  async findByIssueId(issueId: string): Promise<CommentDomainEntity[]> {
    const entities = await this.commentTypeormRepository.find({
      where: { issue_id: issueId },
      order: { _created_at: 'ASC' },
    });
    return entities.map(CommentMapper.toDomain);
  }

  async findByCommentorId(commentorId: string): Promise<CommentDomainEntity[]> {
    const entities = await this.commentTypeormRepository.find({
      where: { commentor_id: commentorId },
      order: { _created_at: 'DESC' },
    });
    return entities.map(CommentMapper.toDomain);
  }

  async update(entity: CommentDomainEntity): Promise<CommentDomainEntity> {
    const typeormEntity = CommentMapper.toEntity(entity);
    await this.commentTypeormRepository.update(entity._id, typeormEntity);
    const updatedEntity = await this.commentTypeormRepository.findOne({
      where: { _id: entity._id },
    });
    return updatedEntity ? CommentMapper.toDomain(updatedEntity) : entity;
  }

  async delete(_id: string): Promise<void> {
    await this.commentTypeormRepository.delete(_id);
  }

  /**
   * Найти комментарий с задачей
   */
  async findByIdWithIssue(commentId: string): Promise<CommentDomainEntity | null> {
    const entity = await this.commentTypeormRepository.findOne({
      where: { _id: commentId },
      relations: ['issue'],
    });
    return entity ? CommentMapper.toDomain(entity) : null;
  }

  /**
   * Найти комментарии задачи с комментаторами
   */
  async findByIssueIdWithCommentors(issueId: string): Promise<CommentDomainEntity[]> {
    const entities = await this.commentTypeormRepository.find({
      where: { issue_id: issueId },
      relations: [], // Можно добавить связь с Contributor если нужно
      order: { _created_at: 'ASC' },
    });
    return entities.map(CommentMapper.toDomain);
  }
}
