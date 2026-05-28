import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MatrixApiService } from './matrix-api.service';
import { ChatCoopApplicationService } from './chatcoop-application.service';
import { MatrixUserManagementService } from '../../domain/services/matrix-user-management.service';
import { SECRETARY_ROOM_MATRIX } from '../config/matrix-secretary-room.config';
import {
  CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY,
  type ChatcoopManagedMatrixRoomRepository,
} from '../../domain/repositories/managed-matrix-room.repository';
import {
  CHATCOOP_STATE_REPOSITORY,
  type ChatcoopStateRepository,
} from '../../domain/repositories/chatcoop-state.repository';
import type { ManagedMatrixRoomDomainEntity } from '../../domain/entities/managed-matrix-room.entity';

export interface CreateSecretaryRoomInput {
  /** Логин пайщика-создателя (председатель или член совета) */
  creatorUsername: string;
  /** Роль создателя в кооперативе — для прав в комнате (chairman / member) */
  creatorRole: string;
  /** Название комнаты */
  displayName: string;
  /** true — публичная (любой может войти), false — приватная (вход по приглашению) */
  isPublic: boolean;
}

/**
 * Управление комнатами секретаря: создание/удаление и список всех комнат реестра.
 *
 * Принцип безопасности: секретарь присутствует ТОЛЬКО в комнатах, созданных нашим бэкендом
 * (kind `secretary`, а также системные members/council и проектные capital_project). Произвольные
 * «чужие» Matrix-комнаты сюда не подключаются — Synapse общий на все кооперативы, и force-join в
 * чужую комнату был бы дырой.
 */
@Injectable()
export class SecretaryRoomManagementService {
  private readonly logger = new Logger(SecretaryRoomManagementService.name);

  constructor(
    private readonly matrixApi: MatrixApiService,
    private readonly chatCoopApplicationService: ChatCoopApplicationService,
    private readonly matrixUserManagement: MatrixUserManagementService,
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedRooms: ChatcoopManagedMatrixRoomRepository,
    @Inject(CHATCOOP_STATE_REPOSITORY)
    private readonly chatcoopState: ChatcoopStateRepository
  ) {}

  async listRooms(): Promise<ManagedMatrixRoomDomainEntity[]> {
    return this.managedRooms.findAll();
  }

  async createSecretaryRoom(input: CreateSecretaryRoomInput): Promise<ManagedMatrixRoomDomainEntity> {
    const st = await this.chatcoopState.getSingleton();
    if (!st.isInitialized || !st.spaceId || st.spaceId.trim().length === 0) {
      throw new BadRequestException('ChatCoop не инициализирован — нельзя создать комнату секретаря');
    }
    const secretaryId = st.secretaryMatrixUserId;
    if (typeof secretaryId !== 'string' || secretaryId.trim().length === 0) {
      throw new BadRequestException('Секретарь не инициализирован — нельзя создать комнату секретаря');
    }
    const displayName = input.displayName.trim();
    if (displayName.length === 0) {
      throw new BadRequestException('Название комнаты не может быть пустым');
    }

    const adminUserId = this.matrixApi.getAdminUserId();
    const powerLevels = SECRETARY_ROOM_MATRIX.buildPowerLevels(adminUserId);
    const isPrivate = !input.isPublic;

    const roomId = await this.matrixApi.createRoom(
      displayName.slice(0, 240),
      `Комната секретаря — создал ${input.creatorUsername}`,
      isPrivate,
      SECRETARY_ROOM_MATRIX.roomType,
      SECRETARY_ROOM_MATRIX.initialState.length > 0 ? SECRETARY_ROOM_MATRIX.initialState : undefined,
      // Комната секретаря всегда незашифрована — иначе секретарь не читает сообщения и не транскрибирует.
      false,
      powerLevels as Record<string, unknown>
    );

    await this.matrixApi.addRoomToSpace(st.spaceId.trim(), roomId);

    // Force-join только секретарь.
    await this.matrixApi.joinRoom(secretaryId.trim(), roomId);

    // Создатель сразу входит в свою комнату с правами модератора.
    const creatorMatrix = await this.matrixUserManagement.getMatrixUserByCoopUsername(input.creatorUsername);
    if (creatorMatrix) {
      try {
        await this.matrixApi.joinRoom(creatorMatrix.matrixUserId, roomId);
        await this.chatCoopApplicationService.applyMembersRoomStylePowerForUser(
          creatorMatrix.matrixUserId,
          roomId,
          input.creatorRole
        );
      } catch (err) {
        this.logger.warn(`Не удалось ввести создателя ${input.creatorUsername} в комнату ${roomId}: ${String(err)}`);
      }
    } else {
      this.logger.warn(`Нет Matrix-аккаунта для создателя ${input.creatorUsername} — он войдёт позже сам`);
    }

    const room = await this.managedRooms.upsertRoom({
      matrixRoomId: roomId,
      encrypted: false,
      kind: 'secretary',
      displayLabel: displayName,
      projectHash: null,
      secretaryInRoom: true,
    });

    this.logger.log(
      `Создана комната секретаря ${roomId} (${isPrivate ? 'приватная' : 'публичная'}) создателем ${input.creatorUsername}`
    );
    return room;
  }

  /**
   * Удаляет комнату секретаря: выводит секретаря из Matrix-комнаты и убирает запись из реестра ChatCoop.
   * Сама Matrix-комната не уничтожается — её участники сохраняют доступ и историю, но транскрипция/синхронизация прекращаются.
   * Разрешено только для kind `secretary` — системные и проектные комнаты так удалять нельзя.
   *
   * На вход — внутренний идентификатор реестра (`id`), а НЕ Matrix room id: интерфейс не оперирует
   * Matrix room id, чтобы не раздавать handle для входа в приватные комнаты.
   */
  async removeSecretaryRoom(id: string): Promise<string> {
    const room = await this.managedRooms.findById(id);
    if (!room) {
      throw new NotFoundException('Комната не найдена в реестре ChatCoop');
    }
    if (room.kind !== 'secretary') {
      throw new BadRequestException('Удалять можно только комнаты секретаря (системные и проектные защищены)');
    }

    const matrixRoomId = room.matrixRoomId;
    const st = await this.chatcoopState.getSingleton();
    const secretaryId = st.secretaryMatrixUserId;
    if (typeof secretaryId === 'string' && secretaryId.trim().length > 0) {
      try {
        await this.matrixApi.kickUser(secretaryId.trim(), matrixRoomId, 'Комната секретаря удалена');
      } catch (err) {
        this.logger.warn(`Не удалось вывести секретаря из ${matrixRoomId}: ${String(err)}`);
      }
    }

    await this.managedRooms.setSecretaryInRoom(matrixRoomId, false);
    await this.managedRooms.deleteByMatrixRoomId(matrixRoomId);
    this.logger.log(`Комната секретаря ${id} удалена из реестра`);
    return id;
  }
}
