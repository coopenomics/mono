import { Cooperative } from 'cooptypes';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { Inject, Injectable } from '@nestjs/common';
import { MEET_BLOCKCHAIN_PORT, MeetBlockchainPort } from '~/domain/meet/ports/meet-blockchain.port';
import { MeetPreProcessingRepository, MEET_REPOSITORY } from '~/domain/meet/repositories/meet-pre.repository';
import { MeetAggregate } from '~/domain/meet/aggregates/meet-domain.aggregate';
import type { CreateAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/create-annual-meet-input-domain.interface';
import { DocumentAggregator } from '~/domain/document/aggregators/document.aggregator';
import { MeetPreProcessingDomainEntity } from '~/domain/meet/entities/meet-pre-domain.entity';
import { VoteOnAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/vote-on-annual-general-meet-input.interface';
import { RestartAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/restart-annual-general-meet-input-domain.interface';
import { GetMeetInputDomainInterface } from '~/domain/meet/interfaces/get-meet-input-domain.interface';
import { GetMeetsInputDomainInterface } from '~/domain/meet/interfaces/get-meets-input-domain.interface';
import { SignBySecretaryOnAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/sign-by-secretary-on-annual-general-meet-input-domain.interface';
import { SignByPresiderOnAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/sign-by-presider-on-annual-general-meet-input-domain.interface';
import { MEET_PROCESSED_REPOSITORY, MeetProcessedRepository } from '~/domain/meet/repositories/meet-processed.repository';
import { ProcessMeetDecisionInputDomainInterface } from '~/domain/meet/interfaces/process-meet-decision-input-domain.interface';
import { MeetProcessedDomainEntity } from '~/domain/meet/entities/meet-processed-domain.entity';
import { NotifyOnAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/notify-on-annual-general-meet-input-domain.interface';
import { generateUniqueHash } from '~/utils/generate-hash.util';
import httpStatus from 'http-status';
import { HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class MeetInteractor {
  constructor(
    private readonly documentDomainService: DocumentDomainService,
    @Inject(MEET_REPOSITORY) private readonly meetPreRepository: MeetPreProcessingRepository,
    @Inject(MEET_PROCESSED_REPOSITORY) private readonly meetProcessedRepository: MeetProcessedRepository,
    @Inject(MEET_BLOCKCHAIN_PORT) private readonly meetBlockchainPort: MeetBlockchainPort,
    private readonly documentAggregator: DocumentAggregator
  ) {}

  async generateAnnualGeneralMeetAgendaDocument(
    data: Cooperative.Registry.AnnualGeneralMeetingAgenda.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingAgenda.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async createAnnualGeneralMeet(data: CreateAnnualGeneralMeetInputDomainInterface): Promise<MeetAggregate> {
    // Создаем агрегатор документов с помощью агрегатора документов
    const documentAggregate = await this.documentAggregator.buildDocumentAggregate(data.proposal);

    // Преобразуем null в undefined для соответствия доменному интерфейсу
    const proposalAggregate = documentAggregate || undefined;

    // Генерируем уникальный хэш для собрания
    const hash = generateUniqueHash();

    const detailsNormalized = MeetInteractor.normalizeMeetDetailsField(data.details);

    const preProcessing = new MeetPreProcessingDomainEntity({
      ...data,
      hash,
      proposal: proposalAggregate,
      details: detailsNormalized,
    });

    // Сохраняем данные в репозиторий
    await this.meetPreRepository.create(preProcessing);

    // Вызов блокчейн порта для создания собрания
    await this.meetBlockchainPort.createMeet({ ...data, hash });

    // Задержка синхронизации на 1 секунду, чтобы избежать ошибки "row not found"
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Получаем обновленные данные из блокчейна
    const processingData = await this.meetBlockchainPort.getMeet({
      coopname: data.coopname,
      hash: preProcessing.hash,
    });

    // Получаем сохраненные данные из репозитория
    const preMeet = await this.meetPreRepository.findByHash(preProcessing.hash);

    // Создаем агрегат из обоих источников данных (репозиторий и блокчейн)
    return new MeetAggregate(preMeet, processingData);
  }

  async generateAnnualGeneralMeetDecisionDocument(
    data: Cooperative.Registry.AnnualGeneralMeetingDecision.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateAnnualGeneralMeetNotificationDocument(
    data: Cooperative.Registry.AnnualGeneralMeetingNotification.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingNotification.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateSovietDecisionOnAnnualMeetDocument(
    data: Cooperative.Registry.AnnualGeneralMeetingSovietDecision.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingSovietDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateBallotForAnnualGeneralMeet(
    data: Cooperative.Registry.AnnualGeneralMeetingVotingBallot.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingVotingBallot.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async getMeet(data: GetMeetInputDomainInterface, username?: string): Promise<MeetAggregate> {
    // Получаем данные из блокчейна через порт
    const processingMeet = await this.meetBlockchainPort.getMeet({
      coopname: data.coopname,
      hash: data.hash,
      username,
    });

    // Получаем данные из репозитория
    const preMeet = await this.meetPreRepository.findByHash(data.hash);

    // Получаем данные из репозитория обработанных собраний
    const processedMeetEntity = await this.meetProcessedRepository.findByHash(data.hash);

    // Создаем агрегат из обоих источников данных (репозиторий и блокчейн)
    const meetAggregate = new MeetAggregate(preMeet, processingMeet, processedMeetEntity);

    // Вернем готовый агрегат
    return meetAggregate;
  }

  async getMeets(data: GetMeetsInputDomainInterface, username?: string): Promise<MeetAggregate[]> {
    // Получаем данные из блокчейна через порт
    const processingDataList = await this.meetBlockchainPort.getMeets({
      coopname: data.coopname,
      username,
    });

    // Если данных нет, возвращаем пустой массив
    if (!processingDataList || processingDataList.length === 0) {
      return [];
    }

    // Преобразуем данные в агрегаты, получая для каждого элемента данные из репозитория
    const meetsAggregates = await Promise.all(
      processingDataList.map(async (processingData) => {
        // Получаем данные pre из репозитория для каждого элемента по его хешу
        const preMeet = await this.meetPreRepository.findByHash(processingData.hash);

        // Получаем данные processed из репозитория
        const processedMeetEntity = await this.meetProcessedRepository.findByHash(processingData.hash);
        // Создаем агрегат с данными из репозитория и блокчейна
        return new MeetAggregate(preMeet, processingData, processedMeetEntity);
      })
    );

    return meetsAggregates;
  }

  async vote(data: VoteOnAnnualGeneralMeetInputDomainInterface): Promise<MeetAggregate> {
    // Вызов блокчейн порта для голосования
    await this.meetBlockchainPort.vote(data);

    // Получаем обновленные данные из обоих источников
    const processingData = await this.meetBlockchainPort.getMeet({
      coopname: data.coopname,
      hash: data.hash,
      username: data.username,
    });

    const preMeet = await this.meetPreRepository.findByHash(data.hash);
    const processedMeetEntity = await this.meetProcessedRepository.findByHash(data.hash);

    // Создаем агрегат из обоих источников данных
    return new MeetAggregate(preMeet, processingData, processedMeetEntity);
  }

  async restartMeet(data: RestartAnnualGeneralMeetInputDomainInterface): Promise<MeetAggregate> {
    const oldPre = await this.meetPreRepository.findByHash(data.hash);

    const new_hash = await this.meetBlockchainPort.restartMeet(data);

    const processingData = await this.meetBlockchainPort.getMeet({
      coopname: data.coopname,
      hash: new_hash,
    });

    if (!processingData) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Собрание после перезапуска не найдено в блокчейне');
    }

    const proposalAggregate = await this.documentAggregator.buildDocumentAggregate(data.newproposal);

    const meetRow = processingData.meet;
    const agendaFromChain = processingData.questions.map((q) => ({
      context: q.context,
      title: q.title,
      decision: q.decision,
    }));

    const detailsForNewPre = MeetInteractor.normalizeMeetDetailsField(data.details);

    const preProcessing = new MeetPreProcessingDomainEntity({
      hash: new_hash,
      coopname: meetRow.coopname,
      initiator: oldPre?.initiator ?? meetRow.initiator,
      presider: oldPre?.presider ?? meetRow.presider,
      secretary: oldPre?.secretary ?? meetRow.secretary,
      agenda: agendaFromChain,
      open_at: meetRow.open_at,
      close_at: meetRow.close_at,
      proposal: proposalAggregate ?? undefined,
      details: detailsForNewPre,
    });

    await this.meetPreRepository.create(preProcessing);

    const preMeet = await this.meetPreRepository.findByHash(new_hash);
    const processedMeetEntity = await this.meetProcessedRepository.findByHash(new_hash);

    return new MeetAggregate(preMeet, processingData, processedMeetEntity);
  }

  /** Пустая строка → отсутствие значения в PG */
  private static normalizeMeetDetailsField(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const t = value.trim();
    return t.length > 0 ? t : null;
  }

  async signBySecretaryOnAnnualGeneralMeet(
    data: SignBySecretaryOnAnnualGeneralMeetInputDomainInterface
  ): Promise<MeetAggregate> {
    await this.meetBlockchainPort.signBySecretaryOnAnnualGeneralMeet(data);
    const processingData = await this.meetBlockchainPort.getMeet({
      coopname: data.coopname,
      hash: data.hash,
      username: data.username,
    });
    const preMeet = await this.meetPreRepository.findByHash(data.hash);
    const processedMeetEntity = await this.meetProcessedRepository.findByHash(data.hash);

    return new MeetAggregate(preMeet, processingData, processedMeetEntity);
  }

  async signByPresiderOnAnnualGeneralMeet(
    data: SignByPresiderOnAnnualGeneralMeetInputDomainInterface
  ): Promise<MeetAggregate> {
    await this.meetBlockchainPort.signByPresiderOnAnnualGeneralMeet(data);
    const processingData = await this.meetBlockchainPort.getMeet({
      coopname: data.coopname,
      hash: data.hash,
      username: data.username,
    });
    const preMeet = await this.meetPreRepository.findByHash(data.hash);
    const processedMeetEntity = await this.meetProcessedRepository.findByHash(data.hash);

    return new MeetAggregate(preMeet, processingData, processedMeetEntity);
  }

  /**
   * Обработка события о завершенном общем собрании и его результатах
   * @param data Данные о решении общего собрания
   */
  async processMeetDecision(data: ProcessMeetDecisionInputDomainInterface): Promise<void> {
    // Создаем сущность для обработанных данных собрания
    const processedEntity = new MeetProcessedDomainEntity({
      ...data.decisionData,
    });

    // Сохраняем данные в репозиторий
    await this.meetProcessedRepository.save(processedEntity);
  }

  /**
   * Уведомление о собрании
   * @param data Данные уведомления
   */
  async notifyOnAnnualGeneralMeet(data: NotifyOnAnnualGeneralMeetInputDomainInterface): Promise<MeetAggregate> {
    // Вызов блокчейн порта для отправки уведомления
    await this.meetBlockchainPort.notifyOnAnnualGeneralMeet(data);

    // Получаем обновленные данные из блокчейна
    const processingData = await this.meetBlockchainPort.getMeet({
      coopname: data.coopname,
      hash: data.meet_hash,
      username: data.username,
    });

    // Получаем данные из репозитория
    const preMeet = await this.meetPreRepository.findByHash(data.meet_hash);
    const processedMeetEntity = await this.meetProcessedRepository.findByHash(data.meet_hash);

    // Создаем агрегат из обоих источников данных
    return new MeetAggregate(preMeet, processingData, processedMeetEntity);
  }
}
