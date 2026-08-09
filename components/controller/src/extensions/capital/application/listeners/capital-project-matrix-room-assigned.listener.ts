import { Injectable, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import {
  CAPITAL_PROJECT_MATRIX_ROOM_ASSIGNED_EVENT,
  CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT,
  type ICapitalProjectMatrixRoomAssignedPayload,
  type IChatCoopCapitalProjectRoomEnsureMemberPayload,
} from '~/shared/constants/capital-project-matrix.events';
import { PROJECT_REPOSITORY, type ProjectRepository } from '../../domain/repositories/project.repository';
import { APPENDIX_REPOSITORY, type AppendixRepository } from '../../domain/repositories/appendix.repository';

/**
 * Комната для проекта в Matrix уже создана: сохраняем её идентификатор в карточке проекта
 * и приглашаем всех пайщиков, которым совет уже разрешил участие в этом проекте (если Matrix ещё нет, приглашение отложится до следующего шага).
 */
@Injectable()
export class CapitalProjectMatrixRoomAssignedListener {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projectRepository: ProjectRepository,
    @Inject(APPENDIX_REPOSITORY) private readonly appendixRepository: AppendixRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CapitalProjectMatrixRoomAssignedListener.name);
  }

  @OnEvent(CAPITAL_PROJECT_MATRIX_ROOM_ASSIGNED_EVENT)
  async handleMatrixRoomAssigned(payload: ICapitalProjectMatrixRoomAssignedPayload): Promise<void> {
    try {
      await this.projectRepository.setMatrixRoomId(payload.project_hash, payload.matrix_room_id);
      this.logger.log(`matrix_room_id сохранён для проекта ${payload.project_hash}`);

      const usernames =
        await this.appendixRepository.findDistinctUsernamesWithConfirmedClearanceByProjectHash(
          payload.project_hash
        );
      for (const username of usernames) {
        const ensurePayload: IChatCoopCapitalProjectRoomEnsureMemberPayload = {
          username: username.toLowerCase(),
          matrix_room_id: payload.matrix_room_id,
        };
        this.eventEmitter.emit(CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT, ensurePayload);
      }
      if (usernames.length > 0) {
        this.logger.log(
          `ensure_member: эмит для ${usernames.length} пользователей в комнату проекта ${payload.project_hash}`
        );
      }
    } catch (error) {
      this.logger.error(`Не удалось сохранить matrix_room_id для проекта ${payload.project_hash}: ${String(error)}`, error instanceof Error ? error.stack : undefined);
    }
  }
}
