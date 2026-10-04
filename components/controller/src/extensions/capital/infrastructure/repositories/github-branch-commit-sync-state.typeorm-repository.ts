import { TableStore } from '@coopenomics/extension-kit';
import { CAPITAL_GITHUB_BRANCH_COMMIT_SYNC_STATE_STORE } from '../../infrastructure/database/capital-stores';
import { Inject, Injectable } from '@nestjs/common';
import { GithubBranchCommitSyncStateTypeormEntity } from '../entities/github-branch-commit-sync-state.typeorm-entity';
import type { GithubBranchCommitSyncStateRepository } from '../../domain/repositories/github-branch-commit-sync-state.repository';

@Injectable()
export class GithubBranchCommitSyncStateTypeormRepository implements GithubBranchCommitSyncStateRepository {
  constructor(
    @Inject(CAPITAL_GITHUB_BRANCH_COMMIT_SYNC_STATE_STORE)
    private readonly repo: TableStore<GithubBranchCommitSyncStateTypeormEntity>
  ) {}

  async getState(
    coopname: string,
    githubRepository: string,
    branch: string
  ): Promise<{ last_synced_tip_sha: string | null } | null> {
    const row = await this.repo.findOne({ coopname, github_repository: githubRepository, branch });
    if (!row) {
      return null;
    }
    return { last_synced_tip_sha: row.last_synced_tip_sha };
  }

  async setTipSha(coopname: string, githubRepository: string, branch: string, tipSha: string | null): Promise<void> {
    const existing = await this.repo.findOne({ coopname, github_repository: githubRepository, branch });
    if (!existing) {
      await this.repo.insert({
        coopname,
        github_repository: githubRepository,
        branch,
        last_synced_tip_sha: tipSha,
      });
      return;
    }
    await this.repo.update(
      { id: existing.id },
      {
        last_synced_tip_sha: tipSha,
      }
    );
  }

  async deleteState(coopname: string, githubRepository: string, branch: string): Promise<void> {
    await this.repo.delete({ coopname, github_repository: githubRepository, branch });
  }

  async listBranches(coopname: string, githubRepository: string): Promise<string[]> {
    const rows = await this.repo.find({ coopname, github_repository: githubRepository });
    return rows.map((r) => r.branch);
  }
}
