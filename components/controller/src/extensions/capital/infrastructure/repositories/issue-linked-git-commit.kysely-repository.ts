import { isNull, notNull, oneOf, platformSettings, TableStore } from '@coopenomics/extension-kit';
import { CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE, CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE } from '../../infrastructure/database/capital-stores';
import { Inject, Injectable } from '@nestjs/common';
import { IssueLinkedGitCommitRecord } from '../entities/issue-linked-git-commit.record';
import { IssueLinkedGitCommitShaRecord } from '../entities/issue-linked-git-commit-sha.record';
import type {
  IssueLinkedGitCommitRepository,
  IssueLinkedGitCommitRow,
} from '../../domain/repositories/issue-linked-git-commit.repository';

@Injectable()
export class IssueLinkedGitCommitKyselyRepository implements IssueLinkedGitCommitRepository {
  constructor(
    @Inject(CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE)
    private readonly repo: TableStore<IssueLinkedGitCommitRecord>,
    @Inject(CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE)
    private readonly shaRepo: TableStore<IssueLinkedGitCommitShaRecord>
  ) {}

  private toRow(e: IssueLinkedGitCommitRecord): IssueLinkedGitCommitRow {
    return {
      id: e.id,
      coopname: e.coopname,
      github_owner: e.github_owner,
      github_repo: e.github_repo,
      github_sha: e.github_sha,
      html_url: e.html_url,
      issue_hash: e.issue_hash,
      project_hash: e.project_hash,
      username: e.username,
      commit_message: e.commit_message,
      git_author_login: e.git_author_login ?? null,
      git_author_email: e.git_author_email ?? null,
      committed_at: e.committed_at,
      diff_text: e.diff_text,
      consumed_by_commit_hash: e.consumed_by_commit_hash,
      patch_id: e.patch_id ?? null,
      first_seen_branch: e.first_seen_branch ?? null,
      in_default_branch: e.in_default_branch ?? false,
    };
  }

  async insertLinkedCommit(
    row: Omit<IssueLinkedGitCommitRow, 'id' | 'consumed_by_commit_hash'>
  ): Promise<void> {
    const knownSha = await this.shaRepo.findOne({ coopname: row.coopname, github_sha: row.github_sha });
    if (knownSha) {
      return;
    }
    const legacy = await this.repo.findOne({ coopname: row.coopname, github_sha: row.github_sha });
    if (legacy) {
      await this.registerShaAlias({
        linkedCommitId: legacy.id,
        coopname: row.coopname,
        githubSha: row.github_sha,
        seenBranch: row.first_seen_branch,
      });
      return;
    }
    const inserted = await this.repo.insert({
      coopname: row.coopname,
      github_owner: row.github_owner,
      github_repo: row.github_repo,
      github_sha: row.github_sha,
      html_url: row.html_url,
      issue_hash: row.issue_hash,
      project_hash: row.project_hash,
      username: row.username,
      commit_message: row.commit_message,
      git_author_login: row.git_author_login,
      git_author_email: row.git_author_email,
      committed_at: row.committed_at,
      diff_text: row.diff_text,
      consumed_by_commit_hash: null,
      patch_id: row.patch_id,
      first_seen_branch: row.first_seen_branch,
      in_default_branch: row.in_default_branch,
    });
    const id: string | undefined = inserted.id;
    if (id) {
      await this.registerShaAlias({
        linkedCommitId: id,
        coopname: row.coopname,
        githubSha: row.github_sha,
        seenBranch: row.first_seen_branch,
      });
    }
  }

  async findByAnySha(coopname: string, githubSha: string): Promise<IssueLinkedGitCommitRow | null> {
    const alias = await this.shaRepo.findOne({ coopname, github_sha: githubSha });
    if (alias) {
      const row = await this.repo.findOne({ id: alias.linked_commit_id });
      return row ? this.toRow(row) : null;
    }
    const direct = await this.repo.findOne({ coopname, github_sha: githubSha });
    return direct ? this.toRow(direct) : null;
  }

  async findByPatchIdentity(args: {
    coopname: string;
    githubOwner: string;
    githubRepo: string;
    issueHash: string;
    patchId: string;
  }): Promise<IssueLinkedGitCommitRow | null> {
    const row = await this.repo.findOne({
        coopname: args.coopname,
        github_owner: args.githubOwner,
        github_repo: args.githubRepo,
        issue_hash: args.issueHash.toLowerCase(),
        patch_id: args.patchId,
      });
    return row ? this.toRow(row) : null;
  }

  async registerShaAlias(args: {
    linkedCommitId: string;
    coopname: string;
    githubSha: string;
    seenBranch: string | null;
  }): Promise<void> {
    const exists = await this.shaRepo.findOne({ coopname: args.coopname, github_sha: args.githubSha });
    if (exists) {
      return;
    }
    await this.shaRepo.insert({
      linked_commit_id: args.linkedCommitId,
      coopname: args.coopname,
      github_sha: args.githubSha,
      seen_branch: args.seenBranch,
    });
  }

  async promoteToDefaultBranch(args: {
    linkedCommitId: string;
    canonicalSha: string;
    canonicalHtmlUrl: string;
  }): Promise<void> {
    await this.repo.update(
      { id: args.linkedCommitId },
      { github_sha: args.canonicalSha, html_url: args.canonicalHtmlUrl, in_default_branch: true }
    );
  }

  async findRowsWithoutPatchId(limit: number): Promise<IssueLinkedGitCommitRow[]> {
    const rows = await this.repo.find({ patch_id: isNull() }, { order: { created_at: 'ASC' }, limit: limit });
    return rows.map((e) => this.toRow(e));
  }

  async backfillPatchIdentity(args: {
    id: string;
    patchId: string;
    firstSeenBranch: string | null;
    inDefaultBranch: boolean;
  }): Promise<void> {
    await this.repo.update(
      { id: args.id },
      { patch_id: args.patchId, first_seen_branch: args.firstSeenBranch, in_default_branch: args.inDefaultBranch }
    );
  }

  async findByIssueHash(issueHash: string): Promise<IssueLinkedGitCommitRow[]> {
    const coopname = platformSettings().coopname;
    const rows = await this.repo.find({ coopname, issue_hash: issueHash.toLowerCase() }, { order: { committed_at: 'DESC' } });
    return rows.map((e) => this.toRow(e));
  }

  async findByIssueHashes(issueHashes: string[]): Promise<IssueLinkedGitCommitRow[]> {
    const uniq = [...new Set(issueHashes.map((h) => h.toLowerCase()).filter(Boolean))];
    if (uniq.length === 0) {
      return [];
    }
    const coopname = platformSettings().coopname;
    const rows = await this.repo.find({ coopname, issue_hash: oneOf(uniq) });
    return rows.map((e) => this.toRow(e));
  }

  async findUnconsumedByProjectAndUsername(projectHash: string, username: string): Promise<IssueLinkedGitCommitRow[]> {
    const coopname = platformSettings().coopname;
    const rows = await this.repo.find({
        coopname,
        project_hash: projectHash.toLowerCase(),
        username,
        consumed_by_commit_hash: isNull(),
      }, { order: { committed_at: 'ASC' } });
    return rows.map((e) => this.toRow(e));
  }

  async markConsumed(ids: string[], commitHash: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.repo.update({ id: oneOf(ids) }, { consumed_by_commit_hash: commitHash });
  }

  async hasConsumedRowsByIssueHash(issueHash: string): Promise<boolean> {
    const coopname = platformSettings().coopname;
    const n = await this.repo.count({
        coopname,
        issue_hash: issueHash.toLowerCase(),
        consumed_by_commit_hash: notNull(),
      });
    return n > 0;
  }

  async updateProjectHashByIssueHash(issueHash: string, projectHash: string): Promise<void> {
    const coopname = platformSettings().coopname;
    await this.repo.update(
      { coopname, issue_hash: issueHash.toLowerCase() },
      { project_hash: projectHash.toLowerCase() }
    );
  }
}
