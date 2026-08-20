import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    @InjectRepository(FavoriteTypeormEntity)
    private readonly repo: Repository<FavoriteTypeormEntity>,
    @InjectRepository(ProjectTypeormEntity)
    private readonly projectRepo: Repository<ProjectTypeormEntity>,
    @InjectRepository(IssueTypeormEntity)
    private readonly issueRepo: Repository<IssueTypeormEntity>,
    @InjectRepository(StoryTypeormEntity)
    private readonly storyRepo: Repository<StoryTypeormEntity>
  ) {}

  async add(favorite: Omit<IFavorite, 'created_at'>): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ ...favorite, target_hash: favorite.target_hash.toLowerCase() })
      .orIgnore()
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
    const favorites = await this.repo.find({
      where: { coopname, username },
      order: { created_at: 'ASC' },
    });
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
      this.findTargets(this.projectRepo, 'project_hash', ['parent_hash', 'title'], hashesOf(
        FavoriteTargetType.PROJECT,
        FavoriteTargetType.COMPONENT
      )),
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

  private findTargets<T extends { title: string }>(
    repo: Repository<T>,
    hashColumn: keyof T & string,
    extraColumns: Array<keyof T & string>,
    hashes: string[]
  ): Promise<T[]> {
    if (hashes.length === 0) return Promise.resolve([]);
    return repo.find({
      select: [hashColumn, ...extraColumns] as never,
      where: { [hashColumn]: In(hashes) } as never,
    });
  }

  async targetExists(target_type: FavoriteTargetType, target_hash: string): Promise<boolean> {
    const hash = target_hash.toLowerCase();
    switch (target_type) {
      case FavoriteTargetType.PROJECT:
      case FavoriteTargetType.COMPONENT:
        return (await this.projectRepo.countBy({ project_hash: hash })) > 0;
      case FavoriteTargetType.ISSUE:
        return (await this.issueRepo.countBy({ issue_hash: hash })) > 0;
      case FavoriteTargetType.ARTIFACT:
        return (await this.storyRepo.countBy({ story_hash: hash })) > 0;
    }
  }
}
