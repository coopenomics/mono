import { Injectable, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { APPENDIX_REPOSITORY, type AppendixRepository } from '../../domain/repositories/appendix.repository';
import { PROJECT_REPOSITORY, type ProjectRepository } from '../../domain/repositories/project.repository';
import { CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT, CHATCOOP_MATRIX_USER_LINKED_FOR_CAPITAL_PROJECT_ROOMS_EVENT, type IChatCoopCapitalProjectRoomEnsureMemberPayload, type IChatCoopMatrixUserLinkedForCapitalProjectRoomsPayload } from '@coopenomics/innercoop';

/**
 * Когда у пайщика наконец есть Matrix в коопе, проходим по всем проектам с подтверждённой заявкой на участие
 * и для каждого проекта, у которого уже заведена комната, просим мессенджер добавить этого человека в чат проекта.
 */
@Injectable()
export class ChatCoopMatrixUserLinkedCapitalProjectRoomsListener {
  constructor(
    @Inject(APPENDIX_REPOSITORY) private readonly appendixRepository: AppendixRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepository: ProjectRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(ChatCoopMatrixUserLinkedCapitalProjectRoomsListener.name);
  }

  @OnEvent(CHATCOOP_MATRIX_USER_LINKED_FOR_CAPITAL_PROJECT_ROOMS_EVENT)
  async handle(payload: IChatCoopMatrixUserLinkedForCapitalProjectRoomsPayload): Promise<void> {
    try {
      const username = payload.username.toLowerCase();
      const projectHashes =
        await this.appendixRepository.findDistinctProjectHashesWithConfirmedClearanceByUsername(username);
      for (const ph of projectHashes) {
        const project = await this.projectRepository.findByHash(ph);
        const roomId = project?.matrix_room_id;
        if (!roomId) {
          continue;
        }
        const ensure: IChatCoopCapitalProjectRoomEnsureMemberPayload = {
          username,
          matrix_room_id: roomId,
        };
        this.eventEmitter.emit(CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT, ensure);
      }
    } catch (error) {
      this.logger.error(
        `Синхронизация комнат Capital для ${payload.username}: ${String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}
