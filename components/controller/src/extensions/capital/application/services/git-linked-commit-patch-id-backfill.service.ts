import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  ISSUE_LINKED_GIT_COMMIT_REPOSITORY,
  type IssueLinkedGitCommitRepository,
} from '../../domain/repositories/issue-linked-git-commit.repository';
import { computeGitPatchId } from '../utils/git-patch-id';

/**
 * Дозаполнение идентичности правок у привязок, созданных до перехода на
 * мульти-веточную модель: patch_id считается из уже сохранённого diff_text
 * (без обращений к GitHub API), строка помечается достижимой из базовой ветки
 * (до перехода индексировалась только она) и получает SHA-алиас.
 * Идемпотентно: обрабатываются только строки без patch_id.
 */
@Injectable()
export class GitLinkedCommitPatchIdBackfillService {
  private readonly logger = new Logger(GitLinkedCommitPatchIdBackfillService.name);
  private static readonly BATCH_SIZE = 200;

  constructor(
    @Inject(ISSUE_LINKED_GIT_COMMIT_REPOSITORY)
    private readonly linkedCommitRepository: IssueLinkedGitCommitRepository
  ) {}

  async run(defaultBranch: string): Promise<void> {
    let total = 0;
    for (;;) {
      const rows = await this.linkedCommitRepository.findRowsWithoutPatchId(
        GitLinkedCommitPatchIdBackfillService.BATCH_SIZE
      );
      if (rows.length === 0) {
        break;
      }
      for (const row of rows) {
        const patchId = computeGitPatchId(row.diff_text) ?? row.github_sha;
        await this.linkedCommitRepository.backfillPatchIdentity({
          id: row.id,
          patchId,
          firstSeenBranch: row.first_seen_branch ?? defaultBranch,
          inDefaultBranch: true,
        });
        await this.linkedCommitRepository.registerShaAlias({
          linkedCommitId: row.id,
          coopname: row.coopname,
          githubSha: row.github_sha,
          seenBranch: row.first_seen_branch ?? defaultBranch,
        });
        total += 1;
      }
      if (rows.length < GitLinkedCommitPatchIdBackfillService.BATCH_SIZE) {
        break;
      }
    }
    if (total > 0) {
      this.logger.log(`Git маркеры: patch_id дозаполнен у ${total} существующих привязок`);
    }
  }
}
