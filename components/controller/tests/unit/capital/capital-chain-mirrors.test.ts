/**
 * Хранилища зеркал Благороста на Kysely (C28-81): что уходит в базу.
 *
 * Перенос с TypeORM обязан сохранить условия запросов: по ним решается, какие
 * часы вернутся в учёт, какие истории видны в проекте и чьи коммиты отдаются.
 */
import { CommitTypeormRepository } from '~/extensions/capital/infrastructure/repositories/commit.typeorm-repository';
import { TimeEntryTypeormRepository } from '~/extensions/capital/infrastructure/repositories/time-entry.typeorm-repository';
import { StoryTypeormRepository } from '~/extensions/capital/infrastructure/repositories/story.typeorm-repository';
import { ProjectTypeormRepository } from '~/extensions/capital/infrastructure/repositories/project.typeorm-repository';
import {
  CAPITAL_COMMIT_STORE,
  CAPITAL_CONTRIBUTOR_STORE,
  CAPITAL_PROJECT_STORE,
  CAPITAL_STORY_STORE,
  CAPITAL_TIME_ENTRY_STORE,
  capitalStoreProviders,
} from '~/extensions/capital/infrastructure/database/capital-stores';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';
import { storeFrom } from '../helpers/table-store';

function database(results: ScriptedResult[] = []) {
  const { db, queries } = recordingKysely(results);
  return { store: (token: symbol) => storeFrom(capitalStoreProviders, token, db) as never, queries };
}

describe('учёт времени', () => {
  it('отклонённый коммит возвращает часы в учёт: правятся только записи этого коммита', async () => {
    const { store, queries } = database([{ affected: 2 }]);
    const repository = new TimeEntryTypeormRepository(store(CAPITAL_TIME_ENTRY_STORE));

    await expect(repository.revertCommittedEntriesByCommitHash('commit-1')).resolves.toBe(2);

    expect(queries[0].sql).toContain('update "capital_time_entries" set "is_committed" = $1');
    expect(queries[0].sql).toMatch(/where \(?"commit_hash" = \$\d and "is_committed" = \$\d/);
    expect(queries[0].parameters).toEqual(expect.arrayContaining([false, 'commit-1', true]));
  });

  it('снятие оценки задачи удаляет только неучтённые записи времени', async () => {
    const { store, queries } = database([{ affected: 1 }]);
    const repository = new TimeEntryTypeormRepository(store(CAPITAL_TIME_ENTRY_STORE));

    await repository.deleteUncommittedByIssueHash('issue-1');

    expect(queries[0].sql).toContain('delete from "capital_time_entries"');
    expect(queries[0].parameters).toEqual(['issue-1', false]);
  });
});

describe('коммиты', () => {
  it('коммиты проекта ищутся по хэшу в нижнем регистре; без коммитов за участниками не ходят', async () => {
    const { store, queries } = database([{ rows: [] }]);
    const repository = new CommitTypeormRepository(store(CAPITAL_COMMIT_STORE), {} as never, store(CAPITAL_CONTRIBUTOR_STORE));

    await expect(repository.findByProjectHash('ABC')).resolves.toEqual([]);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toBe('SELECT c.* FROM capital_commits c WHERE (c.project_hash = $1)');
    expect(queries[0].parameters).toEqual(['abc']);
  });
});

describe('истории', () => {
  it('истории проекта: свои и истории его задач, в заданном порядке', async () => {
    const { store, queries } = database([{ rows: [] }]);
    const repository = new StoryTypeormRepository(store(CAPITAL_STORY_STORE), { emit: jest.fn() } as never);

    await expect(repository.findAllByProjectHash('p1')).resolves.toEqual([]);

    expect(queries[0].sql).toBe(
      'SELECT story.* FROM capital_stories story LEFT JOIN capital_issues issue ON issue.issue_hash = story.issue_hash ' +
        'WHERE (story.project_hash = $1) AND ((story.issue_hash IS NULL OR issue.project_hash = $2)) ORDER BY story.sort_order ASC'
    );
    expect(queries[0].parameters).toEqual(['p1', 'p1']);
  });
});

describe('проекты', () => {
  it('проект читается только живым: удалённый в цепи не отдаётся', async () => {
    const { store, queries } = database([{ rows: [] }]);
    const repository = new ProjectTypeormRepository(store(CAPITAL_PROJECT_STORE), {} as never);

    await expect(repository.findByIdWithIssues('p1')).resolves.toBeNull();

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('from "capital_projects"');
    expect(queries[0].parameters).toEqual(['p1', true, 1]);
  });

  it('адреса репозиториев разработки: только живые проекты кооператива, без пустых', async () => {
    const { store, queries } = database([{ rows: [{ url: ' https://example.org/a ' }, { url: 'https://example.org/a' }] }]);
    const repository = new ProjectTypeormRepository(store(CAPITAL_PROJECT_STORE), {} as never);

    await expect(repository.findDistinctDevelopmentRepositoryUrls('voskhod')).resolves.toEqual(['https://example.org/a']);

    expect(queries[0].sql).toContain('SELECT DISTINCT p.development_repository_url AS "url" FROM capital_projects p');
    expect(queries[0].parameters).toEqual(['voskhod', true]);
  });
});
