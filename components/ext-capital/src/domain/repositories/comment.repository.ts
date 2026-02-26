import { CommentDomainEntity } from '../entities/comment.entity';

export interface CommentRepository {
  create(comment: Omit<CommentDomainEntity, '_id'>): Promise<CommentDomainEntity>;
  findById(_id: string): Promise<CommentDomainEntity | null>;
  findAll(): Promise<CommentDomainEntity[]>;
  findByIssueId(issueId: string): Promise<CommentDomainEntity[]>;
  findByCommentorId(commentorId: string): Promise<CommentDomainEntity[]>;
  findByIdWithIssue(commentId: string): Promise<CommentDomainEntity | null>;
  findByIssueIdWithCommentors(issueId: string): Promise<CommentDomainEntity[]>;
  update(entity: CommentDomainEntity): Promise<CommentDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const COMMENT_REPOSITORY = Symbol('CommentRepository');
