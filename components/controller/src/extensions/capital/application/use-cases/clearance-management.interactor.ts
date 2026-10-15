import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import { PROJECT_REPOSITORY, type ProjectRepository } from '../../domain/repositories/project.repository';
import { AppendixStatus } from '../../domain/enums/appendix-status.enum';
import { AppendixDomainEntity } from '../../domain/entities/appendix.entity';
import { LOGGER_PORT, type ILoggerPort,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';
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
   * Заведение строки по действию заявки, которое ещё идёт. Действия блока
   * разбираются параллельно: одобрение в том же блоке искало строку раньше,
   * чем заявка успевала её сохранить, — и допуск не появлялся (C28-80).
   */
  private readonly requestsInFlight = new Map<string, Promise<void>>();

  /**
   * Заявка на допуск, поданная в цепь мимо API (capital::getclearance
   * напрямую). Если председатель одобрил её в том же блоке, строка приложения
   * в цепи создалась и закрылась внутри блока, дельты по ней нет — и одобрение
   * не находило допуск вовсе (C28-80). Строка заводится по действию; строка,
   * пришедшая дельтой раньше действия, получает статус «на рассмотрении»:
   * синхронизатор статус не ставит, и заявка не выглядела ждущей решения.
   * Поданную через API строку не трогаем.
   */
  handleGetClearance(actionData: InnerChainActionRecord): Promise<void> {
    const request = actionData.data as CapitalContract.Actions.GetClearance.IGetClearance;
    const appendixHash = String(request.appendix_hash).toLowerCase();
    // Регистрация — до первого ожидания: одобрение из того же блока стартует
    // сразу следом и должно её увидеть.
    const work = this.recordClearanceRequest(request, appendixHash, actionData.block_num).finally(() =>
      this.requestsInFlight.delete(appendixHash)
    );
    this.requestsInFlight.set(appendixHash, work);
    return work;
  }

  private async recordClearanceRequest(
    request: CapitalContract.Actions.GetClearance.IGetClearance,
    appendixHash: string,
    blockNum: number
  ): Promise<void> {
    const existing = await this.appendixRepository.findByAppendixHash(appendixHash);
    if (existing) {
      if (existing.status !== AppendixStatus.UNDEFINED) return;
      existing.status = AppendixStatus.CREATED;
      await this.appendixRepository.save(existing);
      return;
    }

    const now = new Date();
    const appendix = new AppendixDomainEntity({
      _id: '',
      block_num: blockNum,
      present: false,
      appendix_hash: appendixHash,
      status: AppendixStatus.CREATED,
      _created_at: now,
      _updated_at: now,
    });
    appendix.coopname = request.coopname;
    appendix.username = request.username;
    appendix.project_hash = String(request.project_hash).toLowerCase();
    await this.appendixRepository.save(appendix);
    this.logger.debug(`Заявка на допуск ${appendixHash} заведена по действию цепи`);
  }

  /**
   * Обработать одобрение приложения
   */
  async handleConfirmClearance(actionData: InnerChainActionRecord): Promise<void> {
    try {
      const { data, block_num } = actionData;
      const actionPayload = data as CapitalContract.Actions.ConfirmClearance.IConfirmClearance;

      this.logger.debug(`Обработка одобрения приложения ${actionPayload.appendix_hash} в блоке ${block_num}`);

      const appendixHashNorm = String(actionPayload.appendix_hash).toLowerCase();
      await this.requestsInFlight.get(appendixHashNorm);
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
  async handleDeclineClearance(actionData: InnerChainActionRecord): Promise<void> {
    try {
      const { data, block_num } = actionData;
      const actionPayload = data as CapitalContract.Actions.DeclineClearance.IDeclineClearance;

      this.logger.debug(`Обработка отклонения приложения ${actionPayload.appendix_hash} в блоке ${block_num}`);

      // Найти приложение по appendix_hash (заявка из того же блока — дождаться её)
      const appendixHashNorm = String(actionPayload.appendix_hash).toLowerCase();
      await this.requestsInFlight.get(appendixHashNorm);
      const appendix = await this.appendixRepository.findByAppendixHash(appendixHashNorm);

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
