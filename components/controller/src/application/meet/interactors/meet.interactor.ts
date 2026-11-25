import { type IGenerationOptions, Registry } from '@coopenomics/docs-templates';
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
import { DomainError } from '@coopenomics/extension-kit';
import { MeetVotersDomainService } from '~/domain/meet/services/meet-voters-domain.service';

@Injectable()
export class MeetInteractor {
  constructor(
    private readonly documentDomainService: DocumentDomainService,
    @Inject(MEET_REPOSITORY) private readonly meetPreRepository: MeetPreProcessingRepository,
    @Inject(MEET_PROCESSED_REPOSITORY) private readonly meetProcessedRepository: MeetProcessedRepository,
    @Inject(MEET_BLOCKCHAIN_PORT) private readonly meetBlockchainPort: MeetBlockchainPort,
    private readonly documentAggregator: DocumentAggregator,
    private readonly meetVoters: MeetVotersDomainService
  ) {}

  /**
   * Правило собрания уполномоченных, которое держит контракт, проверяется до
   * обращения в цепь: пайщик получает понятный отказ с кодом, а не текст
   * отклонённой транзакции. Собрание пайщиков и отсутствие собрания в цепи
   * пропускаются — их разбирает контракт.
   */
  private async assertMeetParticipation(
    coopname: string,
    hash: string,
    username: string,
    action: 'vote' | 'notify'
  ): Promise<void> {
    const processing = await this.meetBlockchainPort.getMeet({ coopname, hash });
    if (!processing?.meet) return;
    const participation = await this.meetVoters.getParticipation(processing.meet, username);
    if (!participation.isTrusteesMeet) return;
    if (action === 'vote' && !participation.canVote) {
      throw DomainError.forbidden(participation.branchVoted && participation.canNotify ? 'MEET_BRANCH_ALREADY_VOTED' : 'MEET_NOT_TRUSTEE');
    }
    if (action === 'notify' && !participation.canNotify) {
      throw DomainError.forbidden('MEET_NOT_TRUSTEE');
    }
  }

  async generateAnnualGeneralMeetAgendaDocument(
    data: Registry.AnnualGeneralMeetingAgenda.Action,
    options: IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Registry.AnnualGeneralMeetingAgenda.registry_id;
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

    // Строка заводится до транзакции: её читают обработчики блока созыва.
    // Цепь отказала — строка удаляется, сирот в базе не остаётся (решение
    // владельца 25.09.2026, C28-80; образец 7DD-22).
    await this.meetPreRepository.create(preProcessing);
    try {
      await this.meetBlockchainPort.createMeet({ ...data, hash });
    } catch (error) {
      await this.meetPreRepository.deleteByHash(hash);
      throw error;
    }

    // Транзакция вернулась после разбора своего блока — строка собрания уже в цепи.
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
    data: Registry.AnnualGeneralMeetingDecision.Action,
    options: IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Registry.AnnualGeneralMeetingDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateAnnualGeneralMeetNotificationDocument(
    data: Registry.AnnualGeneralMeetingNotification.Action,
    options: IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Registry.AnnualGeneralMeetingNotification.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateSovietDecisionOnAnnualMeetDocument(
    data: Registry.AnnualGeneralMeetingSovietDecision.Action,
    options: IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Registry.AnnualGeneralMeetingSovietDecision.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateBallotForAnnualGeneralMeet(
    data: Registry.AnnualGeneralMeetingVotingBallot.Action,
    options: IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Registry.AnnualGeneralMeetingVotingBallot.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  /**
   * Повторный созыв меняет хэш собрания в цепи. Ссылка по прежнему хэшу ведёт
   * к действующему созыву по цепочке замен; цепочка ограничена, чтобы ошибка в
   * данных не зациклила чтение.
   */
  private async currentMeetHash(hash: string): Promise<string> {
    let current = hash;
    for (let hop = 0; hop < MeetInteractor.MAX_RESTART_HOPS; hop++) {
      const next = await this.meetPreRepository.findReplacement(current);
      if (!next) return current;
      current = next;
    }
    return current;
  }

  private static readonly MAX_RESTART_HOPS = 20;

  async getMeet(input: GetMeetInputDomainInterface, username?: string): Promise<MeetAggregate> {
    const data = { ...input, hash: await this.currentMeetHash(input.hash) };
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
    await this.assertMeetParticipation(data.coopname, data.hash, data.username, 'vote');
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
      throw DomainError.notFound('MEET_NOT_FOUND_AFTER_RESTART');
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
    await this.meetPreRepository.markReplaced(data.hash, new_hash);

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
    await this.assertMeetParticipation(data.coopname, data.meet_hash, data.username, 'notify');
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
