import { Inject, Injectable } from '@nestjs/common';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { ContentRevisionService } from './content-revision.service';
import { GenerationService } from './generation.service';
import { ProjectManagementService } from './project-management.service';
import { PermissionsService } from './permissions.service';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { ContentEntityType } from '../../domain/enums/content-entity-type.enum';
import { ContentRevisionOrigin } from '../../domain/enums/content-revision-origin.enum';
import type { ContentRevisionTypeormEntity } from '../../infrastructure/entities/content-revision.typeorm-entity';
import { ContentRevisionDTO, ContentRevisionSummaryDTO } from '../dto/content_revisions/content-revision.dto';
import type {
  GetContentRevisionInputDTO,
  GetContentRevisionsInputDTO,
  RestoreContentRevisionInputDTO,
} from '../dto/content_revisions/content-revision-inputs.dto';
import { normalizeDescription } from '../../domain/utils/content-merge.util';
import type { EditProjectInputDTO } from '../dto/project_management/edit-project-input.dto';

/**
 * API истории редакций: чтение с проверкой прав просмотра сущности и откат,
 * который идёт обычным путём записи (проект — в цепь, задача/артефакт — в БД) и сам становится редакцией.
 */
@Injectable()
export class ContentRevisionApiService {
  constructor(
    private readonly contentRevisionService: ContentRevisionService,
    private readonly generationService: GenerationService,
    private readonly projectManagementService: ProjectManagementService,
    private readonly permissionsService: PermissionsService,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository
  ) {}

  async listRevisions(data: GetContentRevisionsInputDTO, currentUser: IMonoAccount): Promise<ContentRevisionSummaryDTO[]> {
    await this.assertCanView(data.entity_type, data.entity_hash, currentUser);
    const rows = await this.contentRevisionService.listRevisions(data.entity_type, data.entity_hash);
    // rows идут по убыванию rev; дельта размера считается к предыдущей (меньшей) редакции
    return rows.map((row, i) => {
      const prev = rows[i + 1];
      return this.toSummary(row, prev ? normalizeDescription(prev.description).length : 0);
    });
  }

  async getRevision(data: GetContentRevisionInputDTO, currentUser: IMonoAccount): Promise<ContentRevisionDTO | null> {
    await this.assertCanView(data.entity_type, data.entity_hash, currentUser);
    const row = await this.contentRevisionService.getRevision(data.entity_type, data.entity_hash, data.rev);
    if (!row) return null;
    const prev =
      data.rev > 1 ? await this.contentRevisionService.getRevision(data.entity_type, data.entity_hash, data.rev - 1) : null;
    return {
      ...this.toSummary(row, prev ? normalizeDescription(prev.description).length : 0),
      description: normalizeDescription(row.description),
      content_format: row.content_format ?? null,
    };
  }

  /** Откат: содержимое редакции `rev` записывается как новая редакция с origin=RESTORE. */
  async restoreRevision(data: RestoreContentRevisionInputDTO, currentUser: IMonoAccount): Promise<ContentRevisionSummaryDTO> {
    await this.assertCanView(data.entity_type, data.entity_hash, currentUser);
    const target = await this.contentRevisionService.getRevision(data.entity_type, data.entity_hash, data.rev);
    if (!target) {
      throw new Error(`Редакция ${data.rev} для ${data.entity_type} ${data.entity_hash} не найдена`);
    }
    const content = { title: target.title, description: normalizeDescription(target.description) };

    switch (data.entity_type) {
      case ContentEntityType.STORY:
        await this.generationService.updateStory(
          {
            story_hash: data.entity_hash,
            ...content,
            base_rev: data.base_rev,
            origin: ContentRevisionOrigin.RESTORE,
          },
          currentUser.username,
          currentUser,
          { restored_from_rev: data.rev }
        );
        break;
      case ContentEntityType.ISSUE:
        await this.generationService.updateIssue(
          {
            issue_hash: data.entity_hash,
            ...content,
            base_rev: data.base_rev,
            origin: ContentRevisionOrigin.RESTORE,
          },
          currentUser.username,
          currentUser,
          { restored_from_rev: data.rev }
        );
        break;
      case ContentEntityType.PROJECT: {
        const project = await this.projectRepository.findByHash(data.entity_hash.toLowerCase());
        if (!project) {
          throw new Error(`Проект с хешем ${data.entity_hash} не найден`);
        }
        // restored_from_rev — служебное поле доменного входа, в GraphQL-DTO его нет
        const input: EditProjectInputDTO & { restored_from_rev?: number } = {
          coopname: project.coopname ?? '',
          project_hash: project.project_hash,
          ...content,
          invite: project.invite ?? '',
          meta: project.meta ?? '',
          data: project.data ?? '',
          base_rev: data.base_rev,
          origin: ContentRevisionOrigin.RESTORE,
          restored_from_rev: data.rev,
        };
        await this.projectManagementService.editProject(input, currentUser);
        break;
      }
    }

    const rows = await this.contentRevisionService.listRevisions(data.entity_type, data.entity_hash);
    const latest = rows[0];
    const prev = rows[1];
    return this.toSummary(latest, prev ? normalizeDescription(prev.description).length : 0);
  }

  private async assertCanView(entityType: ContentEntityType, entityHash: string, currentUser: IMonoAccount): Promise<void> {
    let allowed = false;
    switch (entityType) {
      case ContentEntityType.STORY:
        allowed = (await this.generationService.getStoryByHash(entityHash, currentUser)) !== null;
        break;
      case ContentEntityType.ISSUE:
        allowed = (await this.generationService.getIssueByHash(entityHash, currentUser)) !== null;
        break;
      case ContentEntityType.PROJECT: {
        const project = await this.projectRepository.findByHash(entityHash.toLowerCase());
        allowed = !!project && (await this.permissionsService.canViewProjectArtifacts(project, currentUser));
        break;
      }
    }
    if (!allowed) {
      throw new Error('Недостаточно прав для просмотра истории редакций');
    }
  }

  private toSummary(row: ContentRevisionTypeormEntity, prevLength: number): ContentRevisionSummaryDTO {
    const length = normalizeDescription(row.description).length;
    return {
      entity_type: row.entity_type,
      entity_hash: row.entity_hash,
      rev: row.rev,
      base_rev: row.base_rev ?? null,
      title: row.title,
      content_hash: row.content_hash,
      author: row.author,
      origin: row.origin,
      restored_from_rev: row.restored_from_rev ?? null,
      merged: row.merged,
      description_length: length,
      description_delta: length - prevLength,
      created_at: row.created_at,
    };
  }
}
