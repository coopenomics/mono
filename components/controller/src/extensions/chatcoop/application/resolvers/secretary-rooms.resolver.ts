import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { ActiveUserStatusGuard } from '~/application/auth/guards/active-user-status.guard';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { SecretaryRoomManagementService } from '../services/secretary-room-management.service';
import {
  ChatcoopSecretaryRoomDTO,
  CreateSecretaryRoomInputDTO,
  ManagedRoomKindGql,
  RemoveSecretaryRoomInputDTO,
} from '../dto/secretary-room.dto';
import type { ChatcoopManagedMatrixRoomKind } from '../../domain/entities/managed-matrix-room.entity';
import type { ManagedMatrixRoomDomainEntity } from '../../domain/entities/managed-matrix-room.entity';

function mapManagedKind(kind: ChatcoopManagedMatrixRoomKind): ManagedRoomKindGql {
  switch (kind) {
    case 'members':
      return ManagedRoomKindGql.MEMBERS;
    case 'council':
      return ManagedRoomKindGql.COUNCIL;
    case 'capital_project':
      return ManagedRoomKindGql.CAPITAL_PROJECT;
    case 'secretary':
      return ManagedRoomKindGql.SECRETARY;
  }
}

function toDto(room: ManagedMatrixRoomDomainEntity): ChatcoopSecretaryRoomDTO {
  return {
    id: room.id,
    displayLabel: room.displayLabel || 'Без названия',
    kind: mapManagedKind(room.kind),
    encrypted: room.encrypted,
    secretaryInRoom: room.secretaryInRoom,
    editable: room.kind === 'secretary',
  };
}

/**
 * Управление комнатами секретаря (стол связи desktop).
 * Доступ — председатель и члены совета: они создают комнаты для звонков с секретарём и удаляют свои.
 */
@Resolver()
@UseGuards(GqlJwtAuthGuard, RolesGuard, ActiveUserStatusGuard)
export class SecretaryRoomsResolver {
  private readonly logger = new Logger(SecretaryRoomsResolver.name);

  constructor(private readonly service: SecretaryRoomManagementService) {}

  @Query(() => [ChatcoopSecretaryRoomDTO], {
    name: 'chatcoopListSecretaryRooms',
    description: 'Все комнаты реестра ChatCoop (системные/проектные — read-only, комнаты секретаря — удаляемые)',
  })
  @AuthRoles(['chairman', 'member'])
  async listSecretaryRooms(
    @CurrentUser() user: MonoAccountDomainInterface
  ): Promise<ChatcoopSecretaryRoomDTO[]> {
    this.logger.debug(`chatcoopListSecretaryRooms user=${user.username}`);
    const rooms = await this.service.listRooms();
    return rooms.map(toDto);
  }

  @Mutation(() => ChatcoopSecretaryRoomDTO, {
    name: 'chatcoopCreateSecretaryRoom',
    description: 'Создать комнату с секретарём (публичную или приватную); секретарь подключается сразу',
  })
  @AuthRoles(['chairman', 'member'])
  async createSecretaryRoom(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data', { type: () => CreateSecretaryRoomInputDTO }) data: CreateSecretaryRoomInputDTO
  ): Promise<ChatcoopSecretaryRoomDTO> {
    this.logger.log(`chatcoopCreateSecretaryRoom user=${user.username} isPublic=${data.isPublic}`);
    const room = await this.service.createSecretaryRoom({
      creatorUsername: user.username,
      creatorRole: user.role,
      displayName: data.displayName,
      isPublic: data.isPublic,
    });
    return toDto(room);
  }

  @Mutation(() => String, {
    name: 'chatcoopRemoveSecretaryRoom',
    description: 'Удалить комнату секретаря: вывести секретаря и снять комнату с синхронизации (возвращает идентификатор комнаты в реестре)',
  })
  @AuthRoles(['chairman', 'member'])
  async removeSecretaryRoom(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data', { type: () => RemoveSecretaryRoomInputDTO }) data: RemoveSecretaryRoomInputDTO
  ): Promise<string> {
    this.logger.log(`chatcoopRemoveSecretaryRoom user=${user.username} room=${data.id}`);
    return this.service.removeSecretaryRoom(data.id);
  }
}
