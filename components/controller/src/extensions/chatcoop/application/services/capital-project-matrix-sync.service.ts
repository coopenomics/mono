import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MatrixApiService } from './matrix-api.service';
import { CAPITAL_PROJECT_ROOM_MATRIX } from '../config/matrix-capital-project-room.config';
import { MatrixUserManagementService } from '../../domain/services/matrix-user-management.service';
import { ChatCoopApplicationService } from './chatcoop-application.service';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { USER_REPOSITORY, type UserRepository } from '~/domain/user/repositories/user.repository';
import type { IConfig } from '../../chatcoop-extension.module';
import { CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY } from '../../domain/repositories/managed-matrix-room.repository';
import type { ChatcoopManagedMatrixRoomRepository } from '../../domain/repositories/managed-matrix-room.repository';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import {
  CHATCOOP_STATE_REPOSITORY,
  type ChatcoopStateRepository,
} from '../../domain/repositories/chatcoop-state.repository';
import { CAPITAL_PROJECT_CREATED_EVENT, CAPITAL_PROJECT_MATRIX_ROOM_ASSIGNED_EVENT, CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT, type ICapitalProjectCreatedPayload, type ICapitalProjectMatrixRoomAssignedPayload, type IChatCoopCapitalProjectRoomEnsureMemberPayload } from '@coopenomics/innercoop';

/**
 * Заведение и наполнение Matrix-комнат для проектов Благороста: создание комнаты при появлении проекта,
 * приглашение пайщиков после решения совета или после того, как у пайщика появился Matrix.
 */
@Injectable()
export class CapitalProjectMatrixSyncService {
  private readonly logger = new Logger(CapitalProjectMatrixSyncService.name);

  constructor(
    private readonly matrixApiService: MatrixApiService,
    private readonly matrixUserManagementService: MatrixUserManagementService,
    private readonly chatCoopApplicationService: ChatCoopApplicationService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(CHATCOOP_MANAGED_MATRIX_ROOM_REPOSITORY)
    private readonly managedMatrixRooms: ChatcoopManagedMatrixRoomRepository,
    @Inject(CHATCOOP_STATE_REPOSITORY) private readonly chatcoopState: ChatcoopStateRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(ACCOUNT_PORT) private readonly accountDataPort: IAccountPort
  ) {}

  /** У проекта появилась запись в цепочке — заводим для него комнату переписки в Matrix и уведомляем Capital об адресе комнаты */
  @OnEvent(CAPITAL_PROJECT_CREATED_EVENT)
  async handleProjectCreated(payload: ICapitalProjectCreatedPayload): Promise<void> {
    try {
      const chatcoop = await this.extensionRepository.findByName('chatcoop');
      if (!chatcoop) {
        this.logger.debug('ChatCoop не установлен — пропуск создания комнаты проекта');
        return;
      }
      const st = await this.chatcoopState.getSingleton();
      if (!st.isInitialized || !st.spaceId) {
        this.logger.debug('ChatCoop не инициализирован или нет spaceId в chatcoop_state — пропуск создания комнаты проекта');
        return;
      }

      const roomName = payload.title.slice(0, 240);
      const adminUserId = this.matrixApiService.getAdminUserId();
      const projectMatrix = CAPITAL_PROJECT_ROOM_MATRIX;
      const powerLevels = projectMatrix.buildPowerLevels(adminUserId);

      const roomId = await this.matrixApiService.createRoom(
        roomName,
        `Проект ${payload.project_hash}`,
        projectMatrix.isPrivate,
        projectMatrix.roomType,
        projectMatrix.initialState.length > 0 ? projectMatrix.initialState : undefined,
        projectMatrix.encrypt,
        powerLevels as Record<string, unknown>
      );

      await this.matrixApiService.addRoomToSpace(st.spaceId, roomId);

      // Председатель и совет сразу видят переписку по проекту, если их Matrix-аккаунты в коопе уже заведены
      const councilUsers = await this.userRepository.findByRoles(['chairman', 'member']);
      const seenUsernames = new Set<string>();
      for (const u of councilUsers) {
        if (seenUsernames.has(u.username)) {
          continue;
        }
        seenUsernames.add(u.username);
        const matrixUser = await this.matrixUserManagementService.getMatrixUserByCoopUsername(u.username);
        if (!matrixUser) {
          continue;
        }
        try {
          await this.matrixApiService.joinRoom(matrixUser.matrixUserId, roomId);
          await this.chatCoopApplicationService.applyMembersRoomStylePowerForUser(
            matrixUser.matrixUserId,
            roomId,
            u.role
          );
        } catch (err) {
          this.logger.warn(`Не удалось добавить ${u.username} в комнату проекта ${payload.project_hash}: ${String(err)}`);
        }
      }

      await this.managedMatrixRooms.upsertRoom({
        matrixRoomId: roomId,
        encrypted: projectMatrix.encrypt,
        kind: 'capital_project',
        displayLabel: roomName,
        projectHash: payload.project_hash,
      });

      const secretaryId = st.secretaryMatrixUserId;
      if (typeof secretaryId === 'string' && secretaryId.trim().length > 0) {
        try {
          await this.matrixApiService.joinRoom(secretaryId.trim(), roomId);
          await this.managedMatrixRooms.setSecretaryInRoom(roomId, true);
          this.logger.log(`Секретарь добавлен в комнату проекта ${payload.project_hash}`);
        } catch (err) {
          this.logger.warn(
            `Не удалось добавить секретаря в комнату проекта ${payload.project_hash}: ${String(err)}`
          );
        }
      }

      const assigned: ICapitalProjectMatrixRoomAssignedPayload = {
        project_hash: payload.project_hash,
        matrix_room_id: roomId,
      };
      this.eventEmitter.emit(CAPITAL_PROJECT_MATRIX_ROOM_ASSIGNED_EVENT, assigned);
    } catch (error) {
      this.logger.error(
        `Ошибка Matrix для проекта ${payload.project_hash}: ${String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  /** Вписать пайщика в комнату проекта (вход в комнату и права по роли в кооперативе) */
  @OnEvent(CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT)
  async handleEnsureCapitalProjectRoomMember(payload: IChatCoopCapitalProjectRoomEnsureMemberPayload): Promise<void> {
    try {
      const chatcoop = await this.extensionRepository.findByName('chatcoop');
      if (!chatcoop) {
        this.logger.debug('ChatCoop не установлен — пропуск ensure_member');
        return;
      }
      const st = await this.chatcoopState.getSingleton();
      if (!st.isInitialized || !st.spaceId) {
        this.logger.debug('ChatCoop не инициализирован — пропуск ensure_member');
        return;
      }

      const matrixUser = await this.matrixUserManagementService.getMatrixUserByCoopUsername(payload.username);
      if (!matrixUser) {
        this.logger.debug(`Нет Matrix-аккаунта для ${payload.username} — ensure_member отложен`);
        return;
      }

      const roomId = payload.matrix_room_id;
      const inRoom = await this.matrixApiService.isUserInRoom(matrixUser.matrixUserId, roomId);
      if (!inRoom) {
        await this.matrixApiService.joinRoom(matrixUser.matrixUserId, roomId);
      }

      const account = await this.accountDataPort.getAccount(payload.username);
      const role = account.provider_account?.role || 'user';
      await this.chatCoopApplicationService.applyMembersRoomStylePowerForUser(
        matrixUser.matrixUserId,
        roomId,
        role
      );
    } catch (error) {
      this.logger.warn(
        `ensure_member ${payload.username} room=${payload.matrix_room_id}: ${String(error)}`
      );
    }
  }
}
