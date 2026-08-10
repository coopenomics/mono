import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import { PROJECT_REPOSITORY, type ProjectRepository } from '../../domain/repositories/project.repository';
import { AppendixStatus } from '../../domain/enums/appendix-status.enum';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { CapitalContract } from 'cooptypes';
import { CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT, type IChatCoopCapitalProjectRoomEnsureMemberPayload } from '@coopenomics/innercoop';

/**
 * Интерактор для управления одобрением/отклонением приложений
 */
@Injectable()
export class ClearanceManagementInteractor {
  constructor(
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(ClearanceManagementInteractor.name);
  }

  /**
   * Совет подтвердил заявку на участие в проекте: если чат проекта уже существует, пайщика нужно туда добавить сразу;
   * если комнаты ещё нет, он попадёт в неё позже, когда комната появится или когда заведётся его Matrix.
   */
  private async emitEnsureMemberIfProjectRoomExists(username: string, projectHash: string): Promise<void> {
    const project = await this.projectRepository.findByHash(projectHash.toLowerCase());
    const matrixRoomId = project?.matrix_room_id;
    if (!matrixRoomId) {
      this.logger.debug(
        `Matrix-комната проекта ${projectHash} ещё не задана — пропуск ensure_member для ${username}`
      );
      return;
    }
    const payload: IChatCoopCapitalProjectRoomEnsureMemberPayload = {
      username: username.toLowerCase(),
      matrix_room_id: matrixRoomId,
    };
    this.eventEmitter.emit(CHATCOOP_CAPITAL_PROJECT_ROOM_ENSURE_MEMBER_EVENT, payload);
  }

  /**
   * Обработать одобрение приложения
   */
  async handleConfirmClearance(actionData: ActionDomainInterface): Promise<void> {
    try {
      const { data, block_num } = actionData;
      const actionPayload = data as CapitalContract.Actions.ConfirmClearance.IConfirmClearance;

      this.logger.debug(`Обработка одобрения приложения ${actionPayload.appendix_hash} в блоке ${block_num}`);

      const appendixHashNorm = String(actionPayload.appendix_hash).toLowerCase();
      const appendix = await this.appendixRepository.findByAppendixHash(appendixHashNorm);

      if (appendix) {
        appendix.status = AppendixStatus.CONFIRMED;
        appendix.block_num = block_num;
        await this.appendixRepository.save(appendix);
        this.logger.debug(`Приложение ${actionPayload.appendix_hash} одобрено`);

        const ph = appendix.project_hash;
        const un = appendix.username;
        if (ph && un) {
          await this.emitEnsureMemberIfProjectRoomExists(un, ph);
        }
        return;
      }

      this.logger.warn(`Приложение ${actionPayload.appendix_hash} не найдено для одобрения`);
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string };
      this.logger.error(`Ошибка при обработке одобрения приложения: ${err?.message}`, err?.stack);
    }
  }

  /**
   * Обработать отклонение приложения
   */
  async handleDeclineClearance(actionData: ActionDomainInterface): Promise<void> {
    try {
      const { data, block_num } = actionData;
      const actionPayload = data as CapitalContract.Actions.DeclineClearance.IDeclineClearance;

      this.logger.debug(`Обработка отклонения приложения ${actionPayload.appendix_hash} в блоке ${block_num}`);

      // Найти приложение по appendix_hash
      const appendix = await this.appendixRepository.findByAppendixHash(
        String(actionPayload.appendix_hash).toLowerCase()
      );

      if (!appendix) {
        this.logger.warn(`Приложение ${actionPayload.appendix_hash} не найдено для отклонения`);
        return;
      }

      // Обновить статус и блок
      appendix.status = AppendixStatus.DECLINED;
      appendix.block_num = block_num;

      // Сохранить изменения
      await this.appendixRepository.save(appendix);

      this.logger.debug(`Приложение ${actionPayload.appendix_hash} отклонено`);
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string };
      this.logger.error(`Ошибка при обработке отклонения приложения: ${err?.message}`, err?.stack);
      throw error;
    }
  }
}
