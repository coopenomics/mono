import { IssueDomainEntity } from '../entities/issue.entity';
import type { IssuePriority } from '../enums/issue-priority.enum';
import type { IssueStatus } from '../enums/issue-status.enum';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { IssueFilterInputDTO } from '../../application/dto/generation/issue-filter.input';

export interface IssueRepository {
  create(issue: IssueDomainEntity): Promise<IssueDomainEntity>;
  findById(_id: string): Promise<IssueDomainEntity | null>;
  findByIssueHash(issueHash: string): Promise<IssueDomainEntity | null>;
  findAll(): Promise<IssueDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<IssueDomainEntity[]>;
  findByCreatedBy(createdBy: string): Promise<IssueDomainEntity[]>;
  findByCreators(creatorsUsernames: string[]): Promise<IssueDomainEntity[]>;
  findByStatusAndCreators(status: IssueStatus, creatorsUsernames: string[]): Promise<IssueDomainEntity[]>;
  findCompletedByProjectAndCreators(projectHash: string, creatorsUsernames: string[]): Promise<IssueDomainEntity[]>;
  findBySubmaster(submasterUsername: string): Promise<IssueDomainEntity[]>;
  findByCycleId(cycleId: string): Promise<IssueDomainEntity[]>;
  findByStatus(status: IssueStatus): Promise<IssueDomainEntity[]>;
  findByPriority(priority: IssuePriority): Promise<IssueDomainEntity[]>;
  findByStatuses(statuses: IssueStatus[]): Promise<IssueDomainEntity[]>;
  findByPriorities(priorities: IssuePriority[]): Promise<IssueDomainEntity[]>;
  findByIdWithComments(issueId: string): Promise<IssueDomainEntity | null>;
  findByIdWithStories(issueId: string): Promise<IssueDomainEntity | null>;
  findByIdWithAllRelations(issueId: string): Promise<IssueDomainEntity | null>;
  findByProjectHashWithComments(projectHash: string): Promise<IssueDomainEntity[]>;
  findByProjectHashWithStories(projectHash: string): Promise<IssueDomainEntity[]>;
  findAllPaginated(
    filter?: IssueFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<IssueDomainEntity>>;
  update(entity: IssueDomainEntity): Promise<IssueDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const ISSUE_REPOSITORY = Symbol('IssueRepository');
