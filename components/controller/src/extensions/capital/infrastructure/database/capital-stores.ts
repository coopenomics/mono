import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { ContentRevisionTypeormEntity } from '../entities/content-revision.typeorm-entity';
import { FavoriteTypeormEntity } from '../entities/favorite.typeorm-entity';
import { GithubBranchCommitSyncStateTypeormEntity } from '../entities/github-branch-commit-sync-state.typeorm-entity';
import { GithubCommMessageCursorTypeormEntity } from '../entities/github-comm-message-cursor.typeorm-entity';
import { GithubCommTranscriptionCursorTypeormEntity } from '../entities/github-comm-transcription-cursor.typeorm-entity';
import { GitHubFileIndexTypeormEntity } from '../entities/github-file-index.typeorm-entity';
import { IssueLinkedGitCommitShaTypeormEntity } from '../entities/issue-linked-git-commit-sha.typeorm-entity';
import { IssueLinkedGitCommitTypeormEntity } from '../entities/issue-linked-git-commit.typeorm-entity';
import { ProcessInstanceTypeormEntity } from '../entities/process-instance.entity';
import { ProcessTemplateTypeormEntity } from '../entities/process-template.entity';

/**
 * Шлюзы таблиц расширения: адаптеры хранилищ работают с записями целиком
 * (прочитал, поправил, сохранил), запросы к базе идут через Kysely.
 */
export const CAPITAL_CONTENT_REVISION_STORE = Symbol('Capital.CAPITAL_CONTENT_REVISION_STORE');
export const CAPITAL_FAVORITE_STORE = Symbol('Capital.CAPITAL_FAVORITE_STORE');
export const CAPITAL_GITHUB_BRANCH_COMMIT_SYNC_STATE_STORE = Symbol('Capital.CAPITAL_GITHUB_BRANCH_COMMIT_SYNC_STATE_STORE');
export const CAPITAL_GITHUB_COMM_MESSAGE_CURSOR_STORE = Symbol('Capital.CAPITAL_GITHUB_COMM_MESSAGE_CURSOR_STORE');
export const CAPITAL_GITHUB_COMM_TRANSCRIPTION_CURSOR_STORE = Symbol('Capital.CAPITAL_GITHUB_COMM_TRANSCRIPTION_CURSOR_STORE');
export const CAPITAL_GITHUB_FILE_INDEX_STORE = Symbol('Capital.CAPITAL_GITHUB_FILE_INDEX_STORE');
export const CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE = Symbol('Capital.CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE');
export const CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE = Symbol('Capital.CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE');
export const CAPITAL_PROCESS_INSTANCE_STORE = Symbol('Capital.CAPITAL_PROCESS_INSTANCE_STORE');
export const CAPITAL_PROCESS_TEMPLATE_STORE = Symbol('Capital.CAPITAL_PROCESS_TEMPLATE_STORE');

export const capitalStoreProviders: Provider[] = [
  {
    provide: CAPITAL_CONTENT_REVISION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ContentRevisionTypeormEntity>(db, {
        table: 'capital_content_revisions',
        primaryKey: ['_id'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_FAVORITE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<FavoriteTypeormEntity>(db, {
        table: 'capital_favorites',
        primaryKey: ['_id'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_GITHUB_BRANCH_COMMIT_SYNC_STATE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<GithubBranchCommitSyncStateTypeormEntity>(db, {
        table: 'capital_github_branch_commit_sync_state',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_GITHUB_COMM_MESSAGE_CURSOR_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<GithubCommMessageCursorTypeormEntity>(db, {
        table: 'capital_github_comm_message_cursor',
        primaryKey: ['id'],
        numbers: ['lastOriginServerTs'],
        updatedAt: 'updatedAt',
      }),
  },
  {
    provide: CAPITAL_GITHUB_COMM_TRANSCRIPTION_CURSOR_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<GithubCommTranscriptionCursorTypeormEntity>(db, {
        table: 'capital_github_comm_transcription_cursor',
        primaryKey: ['id'],
        updatedAt: 'updatedAt',
      }),
  },
  {
    provide: CAPITAL_GITHUB_FILE_INDEX_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<GitHubFileIndexTypeormEntity>(db, {
        table: 'capital_github_file_indexes',
        primaryKey: ['id'],
        updatedAt: 'last_synced_at',
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<IssueLinkedGitCommitShaTypeormEntity>(db, {
        table: 'capital_issue_linked_git_commit_shas',
        primaryKey: ['id'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<IssueLinkedGitCommitTypeormEntity>(db, {
        table: 'capital_issue_linked_git_commits',
        primaryKey: ['id'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_PROCESS_INSTANCE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProcessInstanceTypeormEntity>(db, {
        table: 'capital_process_instances',
        primaryKey: ['id'],
        json: ['step_states'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_PROCESS_TEMPLATE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProcessTemplateTypeormEntity>(db, {
        table: 'capital_process_templates',
        primaryKey: ['id'],
        json: ['steps', 'edges'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
];
