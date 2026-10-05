/**
 * Хранилища Благороста вне синхронизации с цепью на Kysely (C28-81):
 * избранное, связи задач с коммитами, шаблоны процессов, история редакций.
 * Перенос с TypeORM обязан сохранить условия и порядок запросов.
 */
import { FavoriteTypeormRepository } from '~/extensions/capital/infrastructure/repositories/favorite.typeorm-repository';
import { IssueLinkedGitCommitTypeormRepository } from '~/extensions/capital/infrastructure/repositories/issue-linked-git-commit.typeorm-repository';
import { ProcessTemplateTypeormRepository } from '~/extensions/capital/infrastructure/repositories/process-template.typeorm-repository';
import { ContentRevisionService } from '~/extensions/capital/application/services/content-revision.service';
import { ContentEntityType } from '~/extensions/capital/domain/enums/content-entity-type.enum';
import { FavoriteTargetType } from '~/extensions/capital/domain/enums/favorite-target-type.enum';
import {
  CAPITAL_CONTENT_REVISION_STORE,
  CAPITAL_FAVORITE_STORE,
  CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE,
  CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE,
  CAPITAL_PROCESS_TEMPLATE_STORE,
  capitalStoreProviders,
} from '~/extensions/capital/infrastructure/database/capital-stores';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';
import { storeFrom } from '../helpers/table-store';

const COOP = 'voskhod';

function database(results: ScriptedResult[] = []) {
  const { db, queries } = recordingKysely(results);
  return { store: (token: symbol) => storeFrom(capitalStoreProviders, token, db) as never, queries };
}

describe('избранное', () => {
  it('повторное добавление не падает и не заводит вторую строку; хэш цели — в нижнем регистре', async () => {
    const { store, queries } = database([{ rows: [] }]);
    const repository = new FavoriteTypeormRepository(store(CAPITAL_FAVORITE_STORE), {} as never, {} as never, {} as never);

    await repository.add({ coopname: COOP, username: 'ant', target_type: FavoriteTargetType.PROJECT, target_hash: 'ABC' });

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('insert into "capital_favorites"');
    expect(queries[0].sql).toContain('on conflict do nothing');
    expect(queries[0].parameters).toEqual([COOP, 'ant', FavoriteTargetType.PROJECT, 'abc']);
  });
});

describe('связи задач с коммитами', () => {
  const commit = {
    coopname: COOP,
    github_owner: 'coopenomics',
    github_repo: 'mono',
    github_sha: 'sha-1',
    html_url: 'https://example.org/commit/sha-1',
    issue_hash: 'issue-1',
    project_hash: 'project-1',
    username: 'ant',
    commit_message: 'fix',
    git_author_login: null,
    git_author_email: null,
    committed_at: new Date(0),
    diff_text: '',
    patch_id: null,
    first_seen_branch: 'main',
    in_default_branch: false,
  };
  const build = (results: ScriptedResult[]) => {
    const { store, queries } = database(results);
    const repository = new IssueLinkedGitCommitTypeormRepository(
      store(CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE),
      store(CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE)
    );
    return { repository, queries };
  };

  it('известный коммит второй раз не записывается', async () => {
    const { repository, queries } = build([{ rows: [{ id: 'alias-1', linked_commit_id: 'c1' }] }]);

    await repository.insertLinkedCommit(commit as never);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('from "capital_issue_linked_git_commit_shas"');
  });

  it('новый коммит: запись и её псевдоним связаны ключом, который вернула база', async () => {
    const { repository, queries } = build([{ rows: [] }, { rows: [] }, { rows: [{ id: 'c1', ...commit }] }, { rows: [] }, { rows: [{ id: 'alias-1' }] }]);

    await repository.insertLinkedCommit(commit as never);

    expect(queries).toHaveLength(5);
    expect(queries[2].sql).toContain('insert into "capital_issue_linked_git_commits"');
    expect(queries[4].sql).toContain('insert into "capital_issue_linked_git_commit_shas"');
    expect(queries[4].parameters).toEqual(expect.arrayContaining(['c1', COOP, 'sha-1']));
  });
});

describe('шаблоны процессов', () => {
  it('правка шаблона идёт по его ключу, шаги уходят в базу как json', async () => {
    const steps = [{ id: 's1', title: 'Шаг' }];
    const { store, queries } = database([{ affected: 1 }, { rows: [{ id: 't1', coopname: COOP, steps, edges: [] }] }]);
    const repository = new ProcessTemplateTypeormRepository(store(CAPITAL_PROCESS_TEMPLATE_STORE));

    const updated = await repository.update('t1', { steps } as never);

    expect(updated).toMatchObject({ id: 't1' });
    expect(queries[0].sql).toContain('update "capital_process_templates" set');
    expect(queries[0].sql).toContain('where "id" = ');
    expect(queries[0].parameters).toEqual(expect.arrayContaining([JSON.stringify(steps), 't1']));
  });
});

describe('история редакций', () => {
  it('список редакций сущности: только её редакции, свежие первыми', async () => {
    const { store, queries } = database([{ rows: [{ content_rev: 2 }] }, { rows: [] }]);
    const service = new ContentRevisionService(store(CAPITAL_CONTENT_REVISION_STORE));

    await expect(service.listRevisions(ContentEntityType.ISSUE, 'hash-1')).resolves.toEqual([]);

    expect(queries[0].sql).toContain('SELECT content_rev FROM capital_issues WHERE issue_hash = $1');
    expect(queries[1].sql).toContain('from "capital_content_revisions"');
    expect(queries[1].sql).toContain('order by "rev" desc');
    expect(queries[1].parameters).toEqual([ContentEntityType.ISSUE, 'hash-1']);
  });
});
