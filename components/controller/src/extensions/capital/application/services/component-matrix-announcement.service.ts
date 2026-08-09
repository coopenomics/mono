import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { ISyncResult } from '@coopenomics/extension-kit/sync';
import { platformSettings } from '@coopenomics/extension-kit';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import {
  MATRIX_ROOM_MESSAGING_PORT,
  PROJECT_COMMUNICATION_ARTIFACTS_PORT,
  type IMatrixRoomMessagingPort,
  type IProjectCommunicationArtifactsPort,
} from '@coopenomics/innercoop';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { ProjectDomainEntity } from '../../domain/entities/project.entity';
import type { IProjectMatrixComponentAnnouncementEvent } from '../../domain/interfaces/project-database.interface';

/**
 * Публикация в Matrix обычных сообщений об анонсе компонента (проекты с parent_hash)
 * в комнатах родительского проекта — без закрепа (закрепы только у документов).
 */
@Injectable()
export class ComponentMatrixAnnouncementService {
  private readonly logger = new Logger(ComponentMatrixAnnouncementService.name);

  constructor(
    @Optional()
    @Inject(MATRIX_ROOM_MESSAGING_PORT)
    private readonly matrixRoomMessaging: IMatrixRoomMessagingPort | undefined,
    @Optional()
    @Inject(PROJECT_COMMUNICATION_ARTIFACTS_PORT)
    private readonly projectCommArtifacts: IProjectCommunicationArtifactsPort | undefined,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository
  ) {}

  /**
   * После syncProject (ответ цепочки сразу после транзакции).
   * Публикация только при первой появлении строки в БД (before == null), иначе дубли при каждом open/setPlan и т.д.
   */
  onProjectSyncedFromTransact(entity: ProjectDomainEntity, before: ProjectDomainEntity | null): void {
    void this.runSideEffects({
      entity,
      previousTitle: before?.title,
      matrixRefsBeforeSync: before?.matrix_component_announcement_events ?? [],
      syncResult: null,
      transactSyncIsNewRow: before === null,
    });
  }

  /**
   * После дельты парсера (handleSyncDelta).
   */
  onProjectSyncedFromDelta(params: {
    entity: ProjectDomainEntity;
    syncResult: ISyncResult;
    present: boolean;
    previousTitle?: string;
    matrixRefsBeforeSync: IProjectMatrixComponentAnnouncementEvent[];
  }): void {
    void this.runSideEffects({
      entity: params.entity,
      previousTitle: params.previousTitle,
      matrixRefsBeforeSync: params.matrixRefsBeforeSync,
      syncResult: params.syncResult,
      presentFromDelta: params.present,
      transactSyncIsNewRow: false,
    });
  }

  /** Сразу при удалении компонента из UI: redact сообщений в Matrix (до дельты парсера). */
  removePinnedForDeletedComponent(projectEntity: ProjectDomainEntity): void {
    void (async () => {
      try {
        const refs = projectEntity.matrix_component_announcement_events ?? [];
        if (!refs.length) {
          return;
        }
        await this.removeAnnouncements(refs);
        await this.clearStoredEvents(projectEntity.project_hash);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Удаление анонса компонента в Matrix при deleteProject: ${msg}`);
      }
    })();
  }

  private async runSideEffects(params: {
    entity: ProjectDomainEntity;
    previousTitle?: string;
    matrixRefsBeforeSync: IProjectMatrixComponentAnnouncementEvent[];
    syncResult: ISyncResult | null;
    presentFromDelta?: boolean;
    transactSyncIsNewRow?: boolean;
  }): Promise<void> {
    try {
      const { entity, previousTitle, matrixRefsBeforeSync, syncResult, presentFromDelta, transactSyncIsNewRow } =
        params;
      if (!entity.isComponent()) {
        return;
      }

      const present = presentFromDelta ?? entity.present;

      if (!present) {
        const refs =
          matrixRefsBeforeSync.length > 0
            ? matrixRefsBeforeSync
            : (entity.matrix_component_announcement_events ?? []);
        if (refs.length > 0) {
          await this.removeAnnouncements(refs);
          await this.clearStoredEvents(entity.project_hash);
        }
        return;
      }

      const latest = await this.projectRepository.findByHash(entity.project_hash);
      if (!latest?.isComponent() || !latest.present) {
        return;
      }

      const refs = latest.matrix_component_announcement_events ?? [];

      if (refs.length > 0) {
        if (previousTitle !== undefined && latest.title !== previousTitle) {
          await this.syncAnnouncementText(latest);
        }
        return;
      }

      // Только первая появление строки в БД по дельте (created). Не используем updated:
      // иначе любой апдейт проекта в цепочке при ещё пустых refs (гонка с syncProject, сбой
      // persist/Matrix) даёт повторные посты и дубли в чатах.
      const shouldTryPublish =
        syncResult !== null ? syncResult.created === true : transactSyncIsNewRow === true;

      if (shouldTryPublish) {
        const events = await this.publishNewComponent(latest);
        if (events.length > 0) {
          await this.persistEvents(latest.project_hash, events);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Matrix-анонс компонента: ${msg}`);
    }
  }

  private static readonly COMPONENT_ANNOUNCE_ICON = '🧩';

  private buildAnnouncementPlainBody(component: ProjectDomainEntity, coopname: string): string | null {
    const parentHash = component.parent_hash?.trim().toLowerCase() ?? '';
    const emptyHash = DomainToBlockchainUtils.getEmptyHash().toLowerCase();
    if (!parentHash || parentHash === emptyHash) {
      return null;
    }
    const rawTitle =
      component.title && component.title.trim().length > 0 ? component.title.trim() : component.project_hash;
    const nameInQuotes = rawTitle.replace(/\r?\n/g, ' ').replace(/"/g, "'");
    const baseUrl = platformSettings().frontendUrl.replace(/\/$/, '');
    const path = `/${encodeURIComponent(coopname)}/capital/components/${encodeURIComponent(component.project_hash)}/description`;
    const desktopUrl = `${baseUrl}/#${path}`;
    return `${ComponentMatrixAnnouncementService.COMPONENT_ANNOUNCE_ICON} Создан новый компонент "${nameInQuotes}": ${desktopUrl}`;
  }

  private async publishNewComponent(
    component: ProjectDomainEntity
  ): Promise<IProjectMatrixComponentAnnouncementEvent[]> {
    if (!this.matrixRoomMessaging || !this.projectCommArtifacts) {
      return [];
    }
    const coopname = component.coopname?.trim() ?? '';
    if (!coopname) {
      return [];
    }
    const parentHash = component.parent_hash?.trim().toLowerCase() ?? '';
    const emptyHash = DomainToBlockchainUtils.getEmptyHash().toLowerCase();
    if (!parentHash || parentHash === emptyHash) {
      return [];
    }

    const rooms = await this.projectCommArtifacts.listCommunicationRoomsForProject(parentHash);
    if (rooms.length === 0) {
      return [];
    }

    const body = this.buildAnnouncementPlainBody(component, coopname);
    if (!body) {
      return [];
    }

    const published: IProjectMatrixComponentAnnouncementEvent[] = [];
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 400));
      }
      const eventId = await this.matrixRoomMessaging.sendTextMessage({
        matrixRoomId: room.matrixRoomId,
        plainTextBody: body,
      });
      published.push({ matrix_room_id: room.matrixRoomId, event_id: eventId });
    }
    return published;
  }

  private async syncAnnouncementText(component: ProjectDomainEntity): Promise<void> {
    if (!this.matrixRoomMessaging) {
      return;
    }
    const coopname = component.coopname?.trim() ?? '';
    if (!coopname) {
      return;
    }
    const body = this.buildAnnouncementPlainBody(component, coopname);
    if (!body) {
      return;
    }
    for (const ref of component.matrix_component_announcement_events ?? []) {
      try {
        await this.matrixRoomMessaging.replaceTextMessage({
          matrixRoomId: ref.matrix_room_id,
          rootEventId: ref.event_id,
          plainTextBody: body,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Обновление анонса компонента в Matrix (комната ${ref.matrix_room_id}): ${msg}`);
      }
    }
  }

  private async removeAnnouncements(refs: IProjectMatrixComponentAnnouncementEvent[]): Promise<void> {
    if (!this.matrixRoomMessaging || !refs.length) {
      return;
    }
    for (const ref of refs) {
      try {
        await this.matrixRoomMessaging.unpinAndRedactAnnouncement({
          matrixRoomId: ref.matrix_room_id,
          rootEventId: ref.event_id,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Удаление анонса компонента в Matrix (комната ${ref.matrix_room_id}): ${msg}`);
      }
    }
  }

  private async persistEvents(
    projectHash: string,
    events: IProjectMatrixComponentAnnouncementEvent[]
  ): Promise<void> {
    const latest = await this.projectRepository.findByHash(projectHash);
    if (!latest) {
      return;
    }
    latest.matrix_component_announcement_events = events;
    await this.projectRepository.update(latest);
  }

  private async clearStoredEvents(projectHash: string): Promise<void> {
    const latest = await this.projectRepository.findByHash(projectHash);
    if (!latest) {
      return;
    }
    latest.matrix_component_announcement_events = undefined;
    await this.projectRepository.update(latest);
  }
}
