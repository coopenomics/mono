import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { PushResultDomainInput } from '../../domain/actions/push-result-domain-input.interface';
import type { ConvertSegmentDomainInput } from '../../domain/actions/convert-segment-domain-input.interface';
import type { SignActAsContributorDomainInput } from '../../domain/actions/sign-act-as-contributor-domain-input.interface';
import type { SignActAsChairmanDomainInput } from '../../domain/actions/sign-act-as-chairman-domain-input.interface';
import { RESULT_REPOSITORY, ResultRepository } from '../../domain/repositories/result.repository';
import { ResultDomainEntity } from '../../domain/entities/result.entity';
import { SEGMENT_REPOSITORY, SegmentRepository } from '../../domain/repositories/segment.repository';
import { SegmentDomainEntity } from '../../domain/entities/segment.entity';
import { Classes } from '@coopenomics/sdk';
import type { ResultFilterInputDTO } from '../dto/result_submission/result-filter.input';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import { SegmentSyncService } from '../syncers/segment-sync.service';
import { ResultSyncService } from '../syncers/result-sync.service';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

/**
 * Интерактор домена для подведения результатов в CAPITAL контракте
 * Обрабатывает действия связанные с внесением результатов и конвертацией сегментов
 */
@Injectable()
export class ResultSubmissionInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(RESULT_REPOSITORY)
    private readonly resultRepository: ResultRepository,
    @Inject(SEGMENT_REPOSITORY)
    private readonly segmentRepository: SegmentRepository,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    private readonly segmentSyncService: SegmentSyncService,
    private readonly resultSyncService: ResultSyncService,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ResultSubmissionInteractor.name);
  }

  /**
   * Внесение результата в CAPITAL контракте
   */
  async pushResult(data: PushResultDomainInput): Promise<SegmentDomainEntity> {
    // Вызываем блокчейн порт
    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    const transactResult = await this.capitalBlockchainPort.pushResult(blockchainData);

    // Синхронизируем сегмент и результат
    await this.resultSyncService.syncResult(data.result_hash, transactResult);
    const segmentEntity = await this.segmentSyncService.syncSegment(
      data.coopname,
      data.project_hash,
      data.username,
      transactResult
    );

    if (!segmentEntity) {
      throw new Error(`Не удалось синхронизировать сегмент ${data.project_hash}:${data.username} после внесения результата`);
    }

    // Возвращаем обновленную сущность сегмента
    return segmentEntity;
  }

  /**
   * Конвертация сегмента в CAPITAL контракте
   */
  async convertSegment(
    data: ConvertSegmentDomainInput,
    _currentUser: MonoAccountDomainInterface
  ): Promise<SegmentDomainEntity> {
    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      convert_statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.convert_statement),
    };

    // Вызываем блокчейн порт
    await this.capitalBlockchainPort.convertSegment(blockchainData);

    // После успешной конвертации сегмент удаляется из блокчейна,
    // поэтому устанавливаем флаг завершения вместо синхронизации
    const segmentEntity = await this.segmentRepository.markAsCompleted(data.coopname, data.project_hash, data.username);

    if (!segmentEntity) {
      throw new Error(
        `Не удалось найти сегмент ${data.project_hash}:${data.username} для установки флага завершения после конвертации`
      );
    }

    // Возвращаем обновленную сущность сегмента
    return segmentEntity;
  }

  // ============ МЕТОДЫ ЧТЕНИЯ ДАННЫХ ============

  /**
   * Получение всех результатов с фильтрацией и пагинацией
   */
  async getResults(
    filter?: ResultFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ResultDomainEntity>> {
    return await this.resultRepository.findAllPaginated(filter, options);
  }

  /**
   * Получение результата по ID
   */
  async getResultById(_id: string): Promise<ResultDomainEntity | null> {
    return await this.resultRepository.findById(_id);
  }

  /**
   * Подписание акта участником CAPITAL контракта (первая подпись).
   * Участник генерирует акт, подписывает его и отправляет в блокчейн.
   */
  async signActAsContributor(data: SignActAsContributorDomainInput): Promise<SegmentDomainEntity> {
    // Получаем результат из базы данных, чтобы узнать project_hash
    const resultEntity = await this.resultRepository.findByResultHash(data.result_hash);
    if (!resultEntity || !resultEntity.project_hash) {
      throw new Error(`Результат с хэшем ${data.result_hash} не найден или не содержит project_hash`);
    }

    // Валидация подписей: должна быть подпись только от пользователя, который подписывает
    Classes.Document.assertDocumentSignatures(data.act, [data.username]);

    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      act: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.act),
    };

    // Вызываем блокчейн порт для отправки акта с первой подписью
    const transactResult = await this.capitalBlockchainPort.signAct1(blockchainData);

    // Синхронизируем сегмент и результат
    await this.resultSyncService.syncResult(data.result_hash, transactResult);
    const segmentEntity = await this.segmentSyncService.syncSegment(
      data.coopname,
      resultEntity.project_hash,
      data.username,
      transactResult
    );

    if (!segmentEntity) {
      throw new Error(
        `Не удалось синхронизировать сегмент ${resultEntity.project_hash}:${data.username} после подписания акта участником`
      );
    }

    // Возвращаем обновленную сущность сегмента
    return segmentEntity;
  }

  /**
   * Подписание акта председателем CAPITAL контракта (вторая подпись).
   * Председатель получает уже подписанный участником акт из блокчейна,
   * накладывает на него свою подпись и отправляет обратно в блокчейн.
   * Акт НЕ генерируется заново - используется существующий акт с первой подписью.
   */
  async signActAsChairman(data: SignActAsChairmanDomainInput): Promise<SegmentDomainEntity> {
    // Получаем результат из базы данных, чтобы узнать username участника
    const resultEntity = await this.resultRepository.findByResultHash(data.result_hash);
    if (!resultEntity || !resultEntity.username) {
      throw new Error(`Результат с хэшем ${data.result_hash} не найден или не содержит username`);
    }

    // Валидация подписей: должны быть подписи от username (участника) и chairman (председателя)
    Classes.Document.assertDocumentSignatures(data.act, [resultEntity.username, data.chairman]);

    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      username: resultEntity.username,
      act: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.act),
    };

    // Вызываем блокчейн порт для отправки акта с двумя подписями
    const transactResult = await this.capitalBlockchainPort.signAct2(blockchainData);

    // Синхронизируем сегмент
    const segmentEntity = await this.segmentSyncService.syncSegment(
      data.coopname,
      resultEntity.project_hash || '',
      resultEntity.username || '',
      transactResult
    );

    if (!segmentEntity) {
      throw new Error(
        `Не удалось синхронизировать сегмент ${resultEntity.project_hash}:${resultEntity.username} после подписания акта председателем`
      );
    }

    // Результат не синхронизируем - его уже нет в блокчейне отдельной записью

    // Возвращаем обновленную сущность сегмента
    return segmentEntity;
  }

  // ============ МЕТОДЫ СИНХРОНИЗАЦИИ ============
}
