import { CAPITAL_FAVORITE_STORE, CAPITAL_ISSUE_STORE, CAPITAL_PROJECT_STORE, CAPITAL_STORY_STORE } from '../database/capital-stores';
import { oneOf, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import {
  FavoriteRepository,
  IFavorite,
  IFavoriteWithTarget,
} from '../../domain/repositories/favorite.repository';
import { FavoriteTargetType } from '../../domain/enums/favorite-target-type.enum';
import { FavoriteTypeormEntity } from '../entities/favorite.typeorm-entity';
import { ProjectTypeormEntity } from '../entities/project.typeorm-entity';
import { IssueTypeormEntity } from '../entities/issue.typeorm-entity';
import { StoryTypeormEntity } from '../entities/story.typeorm-entity';

@Injectable()
export class FavoriteTypeormRepository implements FavoriteRepository {
  constructor(
    @Inject(CAPITAL_FAVORITE_STORE)
    private readonly repo: TableStore<FavoriteTypeormEntity>,
    @Inject(CAPITAL_PROJECT_STORE)
    private readonly projectRepo: TableStore<ProjectTypeormEntity>,
    @Inject(CAPITAL_ISSUE_STORE)
    private readonly issueRepo: TableStore<IssueTypeormEntity>,
    @Inject(CAPITAL_STORY_STORE)
    private readonly storyRepo: TableStore<StoryTypeormEntity>
  ) {}

  async add(favorite: Omit<IFavorite, 'created_at'>): Promise<void> {
    // Повторное добавление того же избранного — без ошибки и без второй строки.
    await this.repo.kysely
      .insertInto('capital_favorites')
      .values({
        coopname: favorite.coopname,
        username: favorite.username,
        target_type: favorite.target_type,
        target_hash: favorite.target_hash.toLowerCase(),
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
  }

  async remove(favorite: Omit<IFavorite, 'created_at'>): Promise<void> {
    await this.repo.delete({
      coopname: favorite.coopname,
      username: favorite.username,
      target_type: favorite.target_type,
      target_hash: favorite.target_hash.toLowerCase(),
    });
  }

  async findByUserWithTargets(coopname: string, username: string): Promise<IFavoriteWithTarget[]> {
    const favorites = await this.repo.find({ coopname, username }, { order: { created_at: 'ASC' } });
    if (favorites.length === 0) return [];

    const targets = await this.loadTargets(favorites);

    // Цели, удалённые из своих таблиц, из избранного молча выпадают
    return favorites.flatMap((f) => {
      const target = targets.get(f.target_hash);
      if (!target) return [];
      return [
        {
          coopname: f.coopname,
          username: f.username,
          target_type: f.target_type,
          target_hash: f.target_hash,
          created_at: f.created_at,
          title: target.title,
          parent_hash: target.parent_hash,
        },
      ];
    });
  }

  private async loadTargets(
    favorites: FavoriteTypeormEntity[]
  ): Promise<Map<string, { title: string; parent_hash: string | null }>> {
    const hashesOf = (...types: FavoriteTargetType[]) =>
      favorites.filter((f) => types.includes(f.target_type)).map((f) => f.target_hash);

    const [projects, issues, stories] = await Promise.all([
      // Проект и компонент живут в цепи: удаление приходит дельтой и гасит present
      this.findTargets(
        this.projectRepo,
        'project_hash',
        ['parent_hash', 'title'],
        hashesOf(FavoriteTargetType.PROJECT, FavoriteTargetType.COMPONENT),
        { onlyPresent: true }
      ),
      this.findTargets(this.issueRepo, 'issue_hash', ['project_hash', 'title'], hashesOf(
        FavoriteTargetType.ISSUE
      )),
      this.findTargets(this.storyRepo, 'story_hash', ['project_hash', 'issue_hash', 'title'], hashesOf(
        FavoriteTargetType.ARTIFACT
      )),
    ]);

    const targets = new Map<string, { title: string; parent_hash: string | null }>();
    for (const p of projects) {
      targets.set(p.project_hash, { title: p.title, parent_hash: p.parent_hash ?? null });
    }
    for (const i of issues) {
      targets.set(i.issue_hash, { title: i.title, parent_hash: i.project_hash ?? null });
    }
    for (const s of stories) {
      targets.set(s.story_hash, {
        title: s.title,
        parent_hash: s.issue_hash ?? s.project_hash ?? null,
      });
    }
    return targets;
  }

  /**
   * Живые цели избранного.
   *
   * `present` — флаг блокчейн-проекции: дельта об удалении гасит его, а строка
   * в таблице остаётся, поэтому у проектов и компонентов удалённую цель нужно
   * отсеивать явно. У задач и артефактов этого флага нет: они офчейн, никто
   * никогда не ставит им `present = true` (дефолт колонки в базе — false), а
   * удаляются они физически, вместе с записями избранного через
   * removeAllByTargetHash. Фильтр по present выбрасывал их все до одной:
   * запись в избранное ложилась, но обратно не читалась — звёздочка не
   * загоралась, и клик снова слал «добавить».
   */
  private findTargets<T extends { title: string }>(
    repo: TableStore<T>,
    hashColumn: keyof T & string,
    extraColumns: Array<keyof T & string>,
    hashes: string[],
    options: { onlyPresent?: boolean } = {}
  ): Promise<T[]> {
    if (hashes.length === 0) return Promise.resolve([]);
    return repo.find({
        [hashColumn]: oneOf(hashes),
        ...(options.onlyPresent ? { present: true } : {}),
      } as never);
  }

  async targetExists(target_type: FavoriteTargetType, target_hash: string): Promise<boolean> {
    const hash = target_hash.toLowerCase();
    switch (target_type) {
      case FavoriteTargetType.PROJECT:
      case FavoriteTargetType.COMPONENT:
        return (await this.projectRepo.count({ project_hash: hash, present: true })) > 0;
      case FavoriteTargetType.ISSUE:
        return (await this.issueRepo.count({ issue_hash: hash })) > 0;
      case FavoriteTargetType.ARTIFACT:
        return (await this.storyRepo.count({ story_hash: hash })) > 0;
    }
  }

  async removeAllByTargetHash(target_hash: string): Promise<void> {
    await this.repo.delete({ target_hash: target_hash.toLowerCase() });
  }
}
