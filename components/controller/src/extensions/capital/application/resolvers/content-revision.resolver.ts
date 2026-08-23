import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { ContentRevisionApiService } from '../services/content-revision-api.service';
import { ContentRevisionDTO, ContentRevisionSummaryDTO } from '../dto/content_revisions/content-revision.dto';
import {
  GetContentRevisionInputDTO,
  GetContentRevisionsInputDTO,
  RestoreContentRevisionInputDTO,
} from '../dto/content_revisions/content-revision-inputs.dto';

/**
 * История редакций проектов/компонентов, задач и артефактов: список, просмотр, откат.
 */
@Resolver()
export class ContentRevisionResolver {
  constructor(private readonly contentRevisionApiService: ContentRevisionApiService) {}

  @Query(() => [ContentRevisionSummaryDTO], {
    name: 'capitalGetContentRevisions',
    description: 'Список редакций содержимого сущности (новые сверху), без тел',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getContentRevisions(
    @Args('data', { type: () => GetContentRevisionsInputDTO }) data: GetContentRevisionsInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ContentRevisionSummaryDTO[]> {
    return this.contentRevisionApiService.listRevisions(data, currentUser);
  }

  @Query(() => ContentRevisionDTO, {
    name: 'capitalGetContentRevision',
    nullable: true,
    description: 'Одна редакция содержимого с телом',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getContentRevision(
    @Args('data', { type: () => GetContentRevisionInputDTO }) data: GetContentRevisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ContentRevisionDTO | null> {
    return this.contentRevisionApiService.getRevision(data, currentUser);
  }

  @Mutation(() => ContentRevisionSummaryDTO, {
    name: 'capitalRestoreContentRevision',
    description: 'Откат к редакции: её содержимое записывается как новая редакция (origin=RESTORE)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async restoreContentRevision(
    @Args('data', { type: () => RestoreContentRevisionInputDTO }) data: RestoreContentRevisionInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<ContentRevisionSummaryDTO> {
    return this.contentRevisionApiService.restoreRevision(data, currentUser);
  }
}
