import { Inject, Injectable } from '@nestjs/common';
import { GenerateDocumentOptionsInputDTO } from '@coopenomics/extension-kit';
import { type CreateAnnualGeneralMeetInputDTO } from '../dto/create-meet-agenda-input.dto';
import type { AnnualGeneralMeetingAgendaGenerateDocumentInputDTO } from '../../document/documents-dto/annual-general-meeting-agenda-document.dto';
import { MeetInteractor } from '../interactors/meet.interactor';
import { MeetAggregateDTO } from '../dto/meet-aggregate.dto';
import { VoteOnAnnualGeneralMeetInputDTO } from '../dto/vote-on-annual-general-meet-input.dto';
import { RestartAnnualGeneralMeetInputDTO } from '../dto/restart-annual-general-meet-input.dto';
import { Cooperative } from 'cooptypes';
import { GetMeetInputDTO } from '../dto/get-meet-input.dto';
import { GetMeetsInputDTO } from '../dto/get-meets-input.dto';
import { SignBySecretaryOnAnnualGeneralMeetInputDTO } from '../dto/sign-by-secretary-on-annual-general-meet-input.dto';
import { SignByPresiderOnAnnualGeneralMeetInputDTO } from '../dto/sign-by-presider-on-annual-general-meet-input.dto';
import type { GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { AnnualGeneralMeetingVotingBallotGenerateDocumentInputDTO } from '~/application/document/documents-dto/annual-general-meeting-voting-ballot-document.dto';
import { AnnualGeneralMeetingSovietDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/annual-general-meeting-soviet-decision-document.dto';
import { AnnualGeneralMeetingDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/annual-general-meeting-decision-document.dto';
import { AnnualGeneralMeetingNotificationGenerateDocumentInputDTO } from '~/application/document/documents-dto/annual-general-meeting-notification-document.dto';
import { MeetAggregate } from '~/domain/meet/aggregates/meet-domain.aggregate';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import {
  UserCertificateDomainPort,
  USER_CERTIFICATE_DOMAIN_PORT,
} from '~/domain/user/ports/user-certificate-domain.port';
import { DocumentDomainAggregate } from '~/domain/document/aggregates/document-domain.aggregate';
import { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';
import { NotifyOnAnnualGeneralMeetInputDTO } from '../dto/notify-on-annual-general-meet-input.dto';

@Injectable()
export class MeetService {
  constructor(
    private readonly meetInteractor: MeetInteractor,
    private readonly documentInteractor: DocumentInteractor,
    @Inject(USER_CERTIFICATE_DOMAIN_PORT) private readonly userCertificateDomainPort: UserCertificateDomainPort
  ) {}

  /**
   * Преобразует домен-объект в DTO с обогащением документов
   */
  private async toDTO(aggregate: MeetAggregate): Promise<MeetAggregateDTO> {
    // Получаем агрегат документа решения для processed
    let decisionAggregate: DocumentDomainAggregate | null = null;
    if (aggregate.processed?.decision) {
      decisionAggregate = await this.documentInteractor.buildDocumentAggregate(aggregate.processed.decision);
    }

    // Получаем сертификаты инициатора, председателя и секретаря для pre и processing
    let initiatorCertificate: UserCertificateDomainInterface | null = null;
    let presiderCertificate: UserCertificateDomainInterface | null = null;
    let secretaryCertificate: UserCertificateDomainInterface | null = null;

    if (aggregate.pre) {
      initiatorCertificate = await this.userCertificateDomainPort.getCertificateByUsername(aggregate.pre.initiator);
      presiderCertificate = await this.userCertificateDomainPort.getCertificateByUsername(aggregate.pre.presider);
      secretaryCertificate = await this.userCertificateDomainPort.getCertificateByUsername(aggregate.pre.secretary);
    }

    if (aggregate.processing?.meet) {
      // Если нет pre, но есть processing, получаем сертификаты из processing.meet
      initiatorCertificate = await this.userCertificateDomainPort.getCertificateByUsername(
        aggregate.processing.meet.initiator
      );
      presiderCertificate = await this.userCertificateDomainPort.getCertificateByUsername(
        aggregate.processing.meet.presider
      );
      secretaryCertificate = await this.userCertificateDomainPort.getCertificateByUsername(
        aggregate.processing.meet.secretary
      );
    }

    // Получаем сертификаты для processed, если есть processed данные
    let processedPresiderCertificate: UserCertificateDomainInterface | null = null;
    let processedSecretaryCertificate: UserCertificateDomainInterface | null = null;

    if (aggregate.processed) {
      processedPresiderCertificate = await this.userCertificateDomainPort.getCertificateByUsername(
        aggregate.processed.presider
      );
      processedSecretaryCertificate = await this.userCertificateDomainPort.getCertificateByUsername(
        aggregate.processed.secretary
      );
    }

    // Получаем агрегаты документов для processing
    const processingDocuments = aggregate.processing?.meet
      ? {
          proposalAggregate: aggregate.processing.meet.proposal
            ? await this.documentInteractor.buildDocumentAggregate(aggregate.processing.meet.proposal)
            : null,
          authorizationAggregate: aggregate.processing.meet.authorization
            ? await this.documentInteractor.buildDocumentAggregate(aggregate.processing.meet.authorization)
            : null,
          decision1Aggregate: aggregate.processing.meet.decision1
            ? await this.documentInteractor.buildDocumentAggregate(aggregate.processing.meet.decision1)
            : null,
          decision2Aggregate: aggregate.processing.meet.decision2
            ? await this.documentInteractor.buildDocumentAggregate(aggregate.processing.meet.decision2)
            : null,
        }
      : undefined;

    // Создаем DTO с обогащенными документами и сертификатами
    return new MeetAggregateDTO(
      aggregate,
      decisionAggregate,
      processingDocuments,
      presiderCertificate,
      secretaryCertificate,
      initiatorCertificate,
      processedPresiderCertificate,
      processedSecretaryCertificate
    );
  }

  public async generateAnnualGeneralMeetAgendaDocument(
    data: AnnualGeneralMeetingAgendaGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // Устанавливаем registry_id для документа повестки
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingAgenda.registry_id;

    const document = await this.meetInteractor.generateAnnualGeneralMeetAgendaDocument(data, options || {});
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async createAnnualGeneralMeet(data: CreateAnnualGeneralMeetInputDTO): Promise<MeetAggregateDTO> {
    const aggregate = await this.meetInteractor.createAnnualGeneralMeet(data);
    return await this.toDTO(aggregate);
  }

  public async generateAnnualGeneralMeetDecisionDocument(
    data: AnnualGeneralMeetingDecisionGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // Устанавливаем registry_id для документа решения
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingDecision.registry_id;

    const document = await this.meetInteractor.generateAnnualGeneralMeetDecisionDocument(data, options || {});
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateAnnualGeneralMeetNotificationDocument(
    data: AnnualGeneralMeetingNotificationGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // Устанавливаем registry_id для документа уведомления
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingNotification.registry_id;

    const document = await this.meetInteractor.generateAnnualGeneralMeetNotificationDocument(data, options || {});
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateSovietDecisionOnAnnualMeetDocument(
    data: AnnualGeneralMeetingSovietDecisionGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // Устанавливаем registry_id для документа решения совета
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingSovietDecision.registry_id;

    const document = await this.meetInteractor.generateSovietDecisionOnAnnualMeetDocument(data, options || {});
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateBallotForAnnualGeneralMeet(
    data: AnnualGeneralMeetingVotingBallotGenerateDocumentInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    // Устанавливаем registry_id для документа бюллетеня
    data.registry_id = Cooperative.Registry.AnnualGeneralMeetingVotingBallot.registry_id;

    const document = await this.meetInteractor.generateBallotForAnnualGeneralMeet(data, options || {});
    //TODO чтобы избавиться от unknown необходимо строго типизировать ответ фабрики документов
    return document as unknown as GeneratedDocumentDTO;
  }

  public async getMeet(data: GetMeetInputDTO, username?: string): Promise<MeetAggregateDTO> {
    const aggregate = await this.meetInteractor.getMeet(data, username);
    return await this.toDTO(aggregate);
  }

  public async getMeets(data: GetMeetsInputDTO, username?: string): Promise<MeetAggregateDTO[]> {
    const aggregates = await this.meetInteractor.getMeets(data, username);
    return await Promise.all(aggregates.map((aggregate) => this.toDTO(aggregate)));
  }

  public async vote(data: VoteOnAnnualGeneralMeetInputDTO): Promise<MeetAggregateDTO> {
    const aggregate = await this.meetInteractor.vote(data);
    return await this.toDTO(aggregate);
  }

  public async restartMeet(data: RestartAnnualGeneralMeetInputDTO): Promise<MeetAggregateDTO> {
    const aggregate = await this.meetInteractor.restartMeet(data);
    return await this.toDTO(aggregate);
  }

  public async signBySecretaryOnAnnualGeneralMeet(
    data: SignBySecretaryOnAnnualGeneralMeetInputDTO
  ): Promise<MeetAggregateDTO> {
    const aggregate = await this.meetInteractor.signBySecretaryOnAnnualGeneralMeet(data);
    return await this.toDTO(aggregate);
  }

  public async signByPresiderOnAnnualGeneralMeet(
    data: SignByPresiderOnAnnualGeneralMeetInputDTO
  ): Promise<MeetAggregateDTO> {
    const aggregate = await this.meetInteractor.signByPresiderOnAnnualGeneralMeet(data);
    return await this.toDTO(aggregate);
  }

  /**
   * Уведомление о проведении собрания
   * @param data Данные уведомления
   */
  public async notifyOnAnnualGeneralMeet(data: NotifyOnAnnualGeneralMeetInputDTO): Promise<MeetAggregateDTO> {
    const aggregate = await this.meetInteractor.notifyOnAnnualGeneralMeet(data);
    return await this.toDTO(aggregate);
  }
}
