import { Args, Float, Query, Resolver } from '@nestjs/graphql';
import { Inject, Logger, Optional, UseGuards } from '@nestjs/common';
import {
  INTER_PROJECT_COMMUNICATION_ARTIFACTS,
  type InterProjectCommunicationArtifactsPort,
} from '@coopenomics/inter';
import { ActiveUserStatusGuard } from '~/application/auth/guards/active-user-status.guard';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import {
  ChatcoopNonProjectCommunicationRoomDTO,
  ChatcoopProjectCommunicationRoomDTO,
  ChatcoopRoomMessageLineDTO,
  GetMaxOriginServerTsForRoomInputDTO,
  GetProjectCommunicationRoomsInputDTO,
  GetRoomMessagesForUtcDateInputDTO,
  ListUtcDatesWithNewRoomMessagesInputDTO,
  NonProjectRoomKindGql,
  RoomMessageKindGql,
} from '../dto/project-communication.dto';
import type { InterNonProjectRoomKind } from '@coopenomics/inter';

function mapKind(kind: 'text' | 'audio'): RoomMessageKindGql {
  return kind === 'text' ? RoomMessageKindGql.TEXT : RoomMessageKindGql.AUDIO;
}

function mapNonProjectKind(kind: InterNonProjectRoomKind): NonProjectRoomKindGql {
  switch (kind) {
    case 'members':
      return NonProjectRoomKindGql.MEMBERS;
    case 'council':
      return NonProjectRoomKindGql.COUNCIL;
    case 'secretary':
      return NonProjectRoomKindGql.SECRETARY;
  }
}

/**
 * Доступ к данным переписки Capital↔Matrix для синхронизации (blago-cli, секретарь).
 * Источник — порт `INTER_PROJECT_COMMUNICATION_ARTIFACTS` (пакет inter).
 *
 * {@link ActiveUserStatusGuard} — только `users.status === active`; inter-service обход по `server-secret`.
 */
@Resolver()
@UseGuards(GqlJwtAuthGuard, RolesGuard, ActiveUserStatusGuard)
export class ProjectCommunicationResolver {
  private readonly logger = new Logger(ProjectCommunicationResolver.name);

  constructor(
    @Optional()
    @Inject(INTER_PROJECT_COMMUNICATION_ARTIFACTS)
    private readonly comm: InterProjectCommunicationArtifactsPort | undefined
  ) {}

  @Query(() => [ChatcoopProjectCommunicationRoomDTO], {
    name: 'chatcoopListProjectCommunicationRooms',
    description: 'Комнаты Matrix, привязанные к проекту Capital (реестр ChatCoop)',
  })
  @AuthRoles(['chairman', 'member', 'user'])
  async listProjectCommunicationRooms(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data', { type: () => GetProjectCommunicationRoomsInputDTO }) data: GetProjectCommunicationRoomsInputDTO
  ): Promise<ChatcoopProjectCommunicationRoomDTO[]> {
    this.ensureComm();
    this.logger.debug(
      `chatcoopListProjectCommunicationRooms user=${user.username} projectHash=${data.projectHash}`
    );
    const rooms = await this.comm!.listCommunicationRoomsForProject(data.projectHash);
    return rooms.map((r) => ({
      matrixRoomId: r.matrixRoomId,
      displayLabel: r.displayLabel,
    }));
  }

  @Query(() => [ChatcoopNonProjectCommunicationRoomDTO], {
    name: 'chatcoopListNonProjectCommunicationRooms',
    description: 'Комнаты Matrix вне проектов Capital (пайщики/совет/секретарь) — для синхронизации в blago',
  })
  @AuthRoles(['chairman', 'member', 'user'])
  async listNonProjectCommunicationRooms(
    @CurrentUser() user: MonoAccountDomainInterface
  ): Promise<ChatcoopNonProjectCommunicationRoomDTO[]> {
    this.ensureComm();
    this.logger.debug(`chatcoopListNonProjectCommunicationRooms user=${user.username}`);
    const rooms = await this.comm!.listNonProjectCommunicationRooms();
    return rooms.map((r) => ({
      matrixRoomId: r.matrixRoomId,
      displayLabel: r.displayLabel,
      kind: mapNonProjectKind(r.kind),
    }));
  }

  @Query(() => [String], {
    name: 'chatcoopListUtcDatesWithNewRoomMessages',
    description:
      'UTC-даты (YYYY-MM-DD), в которых есть сообщения новее afterOriginServerTsExclusive, для комнаты Matrix',
  })
  @AuthRoles(['chairman', 'member', 'user'])
  async listUtcDatesWithNewRoomMessages(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data', { type: () => ListUtcDatesWithNewRoomMessagesInputDTO })
    data: ListUtcDatesWithNewRoomMessagesInputDTO
  ): Promise<string[]> {
    this.ensureComm();
    this.logger.debug(
      `chatcoopListUtcDatesWithNewRoomMessages user=${user.username} room=${data.matrixRoomId}`
    );
    return this.comm!.listUtcDatesWithNewMessages(data.matrixRoomId, data.afterOriginServerTsExclusive);
  }

  @Query(() => [ChatcoopRoomMessageLineDTO], {
    name: 'chatcoopGetRoomMessagesForUtcDate',
    description: 'Строки истории сообщений Matrix за календарные сутки UTC',
  })
  @AuthRoles(['chairman', 'member', 'user'])
  async getRoomMessagesForUtcDate(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data', { type: () => GetRoomMessagesForUtcDateInputDTO }) data: GetRoomMessagesForUtcDateInputDTO
  ): Promise<ChatcoopRoomMessageLineDTO[]> {
    this.ensureComm();
    this.logger.debug(
      `chatcoopGetRoomMessagesForUtcDate user=${user.username} room=${data.matrixRoomId} date=${data.utcDate}`
    );
    const lines = await this.comm!.getMessagesForRoomAndUtcDate(data.matrixRoomId, data.utcDate);
    return lines.map((m) => ({
      originServerTs: m.originServerTs,
      authorLabel: m.authorLabel,
      coopUsername: m.coopUsername,
      kind: mapKind(m.kind),
      bodyText: m.bodyText,
    }));
  }

  @Query(() => Float, {
    name: 'chatcoopGetMaxOriginServerTsForRoom',
    description: 'Максимальный origin_server_ts в истории комнаты (мс), если есть сообщения',
    nullable: true,
  })
  @AuthRoles(['chairman', 'member', 'user'])
  async getMaxOriginServerTsForRoom(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data', { type: () => GetMaxOriginServerTsForRoomInputDTO }) data: GetMaxOriginServerTsForRoomInputDTO
  ): Promise<number | null> {
    this.ensureComm();
    this.logger.debug(`chatcoopGetMaxOriginServerTsForRoom user=${user.username} room=${data.matrixRoomId}`);
    return this.comm!.getMaxOriginServerTsForRoom(data.matrixRoomId);
  }

  private ensureComm(): void {
    if (!this.comm) {
      throw new Error('Порт артефактов переписки Capital (INTER_PROJECT_COMMUNICATION_ARTIFACTS) недоступен');
    }
  }
}
