import { Resolver, Subscription, Args } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { IssueOutputDTO } from '../dto/generation/issue.dto';
import { CommitOutputDTO } from '../dto/generation/commit.dto';

// Subscription event names
export const CAPITAL_EVENTS = {
  ISSUE_UPDATED: 'capitalIssueUpdated',
  ISSUE_CREATED: 'capitalIssueCreated',
  COMMIT_CREATED: 'capitalCommitCreated',
  COMMIT_UPDATED: 'capitalCommitUpdated',
  PROJECT_UPDATED: 'capitalProjectUpdated',
};

@Resolver()
export class CapitalSubscriptionResolver {
  constructor(@Inject(PUB_SUB) private readonly pubSub: PubSub) {}

  @Subscription(() => IssueOutputDTO, {
    name: 'capitalIssueUpdated',
    description: 'Подписка на обновления задач',
    filter: (payload: any, variables: any) => {
      if (variables.project_hash && payload.capitalIssueUpdated.project_hash !== variables.project_hash) {
        return false;
      }
      return true;
    },
  })
  capitalIssueUpdated(
    @Args('project_hash', { nullable: true }) _projectHash?: string,
  ) {
    return this.pubSub.asyncIterableIterator(CAPITAL_EVENTS.ISSUE_UPDATED);
  }

  @Subscription(() => IssueOutputDTO, {
    name: 'capitalIssueCreated',
    description: 'Подписка на создание задач',
    filter: (payload: any, variables: any) => {
      if (variables.project_hash && payload.capitalIssueCreated.project_hash !== variables.project_hash) {
        return false;
      }
      return true;
    },
  })
  capitalIssueCreated(
    @Args('project_hash', { nullable: true }) _projectHash?: string,
  ) {
    return this.pubSub.asyncIterableIterator(CAPITAL_EVENTS.ISSUE_CREATED);
  }

  @Subscription(() => CommitOutputDTO, {
    name: 'capitalCommitCreated',
    description: 'Подписка на создание коммитов',
    filter: (payload: any, variables: any) => {
      if (variables.project_hash && payload.capitalCommitCreated.project_hash !== variables.project_hash) {
        return false;
      }
      return true;
    },
  })
  capitalCommitCreated(
    @Args('project_hash', { nullable: true }) _projectHash?: string,
  ) {
    return this.pubSub.asyncIterableIterator(CAPITAL_EVENTS.COMMIT_CREATED);
  }

  @Subscription(() => CommitOutputDTO, {
    name: 'capitalCommitUpdated',
    description: 'Подписка на обновления коммитов',
    filter: (payload: any, variables: any) => {
      if (variables.project_hash && payload.capitalCommitUpdated.project_hash !== variables.project_hash) {
        return false;
      }
      return true;
    },
  })
  capitalCommitUpdated(
    @Args('project_hash', { nullable: true }) _projectHash?: string,
  ) {
    return this.pubSub.asyncIterableIterator(CAPITAL_EVENTS.COMMIT_UPDATED);
  }
}
