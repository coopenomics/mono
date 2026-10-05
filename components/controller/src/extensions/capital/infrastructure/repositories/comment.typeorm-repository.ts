import { CAPITAL_COMMENT_STORE } from '../database/capital-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { CommentRepository } from '../../domain/repositories/comment.repository';
import { CommentDomainEntity } from '../../domain/entities/comment.entity';
import { CommentTypeormEntity } from '../entities/comment.typeorm-entity';
import { CommentMapper } from '../mappers/comment.mapper';

@Injectable()
export class CommentTypeormRepository implements CommentRepository {
  constructor(
    @Inject(CAPITAL_COMMENT_STORE)
    private readonly commentTypeormRepository: TableStore<CommentTypeormEntity>
  ) {}

  async create(comment: Omit<CommentDomainEntity, '_id'>): Promise<CommentDomainEntity> {
    const entity = this.commentTypeormRepository.create(CommentMapper.toEntity(comment));
    const savedEntity = await this.commentTypeormRepository.save(entity);
    return CommentMapper.toDomain(savedEntity);
  }

  async findById(_id: string): Promise<CommentDomainEntity | null> {
    const entity = await this.commentTypeormRepository.findOne({ _id });
    return entity ? CommentMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<CommentDomainEntity[]> {
    const entities = await this.commentTypeormRepository.find();
    return entities.map(CommentMapper.toDomain);
  }

  async findByIssueId(issueId: string): Promise<CommentDomainEntity[]> {
    const entities = await this.commentTypeormRepository.find({ issue_id: issueId }, { order: { _created_at: 'ASC' } });
    return entities.map(CommentMapper.toDomain);
  }

  async findByCommentorId(commentorId: string): Promise<CommentDomainEntity[]> {
    const entities = await this.commentTypeormRepository.find({ commentor_id: commentorId }, { order: { _created_at: 'DESC' } });
    return entities.map(CommentMapper.toDomain);
  }

  async update(entity: CommentDomainEntity): Promise<CommentDomainEntity> {
    const typeormEntity = CommentMapper.toEntity(entity);
    await this.commentTypeormRepository.update({ _id: entity._id }, typeormEntity);
    const updatedEntity = await this.commentTypeormRepository.findOne({ _id: entity._id });
    return updatedEntity ? CommentMapper.toDomain(updatedEntity) : entity;
  }

  async delete(_id: string): Promise<void> {
    await this.commentTypeormRepository.delete({ _id: _id });
  }

  /**
   * Найти комментарий с задачей
   */
  async findByIdWithIssue(commentId: string): Promise<CommentDomainEntity | null> {
    const entity = await this.commentTypeormRepository.findOne({ _id: commentId });
    return entity ? CommentMapper.toDomain(entity) : null;
  }

  /**
   * Найти комментарии задачи с комментаторами
   */
  async findByIssueIdWithCommentors(issueId: string): Promise<CommentDomainEntity[]> {
    const entities = await this.commentTypeormRepository.find({ issue_id: issueId }, { order: { _created_at: 'ASC' } });
    return entities.map(CommentMapper.toDomain);
  }
}
