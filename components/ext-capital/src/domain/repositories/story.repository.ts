import { StoryDomainEntity } from '../entities/story.entity';
import type { StoryStatus } from '../enums/story-status.enum';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { StoryFilterInputDTO } from '../../application/dto/generation/story-filter.input';

export interface StoryRepository {
  create(story: StoryDomainEntity): Promise<StoryDomainEntity>;
  findById(_id: string): Promise<StoryDomainEntity | null>;
  findByStoryHash(storyHash: string): Promise<StoryDomainEntity | null>;
  findAll(): Promise<StoryDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<StoryDomainEntity[]>; // Только проектные истории
  findAllByProjectHash(projectHash: string): Promise<StoryDomainEntity[]>; // Все истории проекта
  findAllByProjectHashesAndIssueHashes(projectHashes: string[], issueHashes: string[]): Promise<StoryDomainEntity[]>; // Истории по проектам и задачам
  findProjectStories(projectHash: string): Promise<StoryDomainEntity[]>; // Только проектные истории
  findByIssueHash(issueHash: string): Promise<StoryDomainEntity[]>;
  findByCreatedBy(createdBy: string): Promise<StoryDomainEntity[]>;
  findByStatus(status: StoryStatus): Promise<StoryDomainEntity[]>;
  findAllPaginated(
    filter?: StoryFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<StoryDomainEntity>>;
  update(entity: StoryDomainEntity): Promise<StoryDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const STORY_REPOSITORY = Symbol('StoryRepository');
