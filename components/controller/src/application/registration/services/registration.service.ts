import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CANDIDATE_REPOSITORY, CandidateRepository } from '~/domain/account/repository/candidate.repository';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { CandidateOutputDTO } from '../dto/candidate.dto';
import { CandidateFilterInputDTO } from '../dto/candidate-filter.dto';
import {
  REGISTRATION_DOCUMENTS_SERVICE,
  RegistrationDocumentsService,
} from '~/domain/registration/services/registration-documents.service';
import { GenerateRegistrationDocumentsInputDTO } from '../dto/generate-registration-documents-input.dto';
import { GenerateRegistrationDocumentsOutputDTO } from '../dto/generate-registration-documents-output.dto';
import { ParticipantInteractor } from '~/application/participant/interactors/participant.interactor';
import { RegisterParticipantInputDTO } from '../dto/register-participant-input.dto';
import { AccountDTO } from '~/application/account/dto/account.dto';
import { ParticipantNotificationService } from '~/application/participant/services/participant-notification.service';
import { CreateInitialPaymentInputDTO } from '~/application/gateway/dto/create-initial-payment-input.dto';
import { GatewayPaymentDTO } from '~/application/gateway/dto/gateway-payment.dto';
import { USER_CERTIFICATE_DOMAIN_PORT, UserCertificateDomainPort } from '~/domain/user/ports/user-certificate-domain.port';
import { ParticipantApplicationGenerateDocumentInputDTO } from '~/application/document/documents-dto/participant-application-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { ParticipantApplicationDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/participant-application-decision-document.dto';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(CANDIDATE_REPOSITORY)
    private readonly candidateRepository: CandidateRepository,
    @Inject(REGISTRATION_DOCUMENTS_SERVICE)
    private readonly registrationDocumentsService: RegistrationDocumentsService,
    private readonly participantInteractor: ParticipantInteractor,
    private readonly participantNotificationService: ParticipantNotificationService,
    @Inject(USER_CERTIFICATE_DOMAIN_PORT)
    private readonly userCertificateDomainPort: UserCertificateDomainPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountDataPort: AccountDataPort
  ) {}

  /**
   * Генерация пакета документов для регистрации
   */
  async generateRegistrationDocuments(
    data: GenerateRegistrationDocumentsInputDTO
  ): Promise<GenerateRegistrationDocumentsOutputDTO> {
    const result = await this.registrationDocumentsService.generateRegistrationDocuments(data);

    return new GenerateRegistrationDocumentsOutputDTO(result);
  }

  /**
   * Получение списка кандидатов с пагинацией
   */
  async getCandidates(
    currentUser: MonoAccountDomainInterface,
    filter?: CandidateFilterInputDTO,
    options: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<CandidateOutputDTO>> {
    let referer = filter?.referer;

    // Проверка ролей: если не председатель и не член совета, проверяем доступ
    if (currentUser.role !== 'chairman' && currentUser.role !== 'member') {
      if (filter?.referer && filter.referer !== currentUser.username) {
        throw new ForbiddenException('У вас нет доступа к просмотру кандидатов другого реферера');
      }
      referer = currentUser.username;
    }

    const { items, totalCount } = await this.candidateRepository.findAllPaginated({
      page: options.page || 1,
      limit: options.limit || 10,
      sortOrder: (options.sortOrder as 'ASC' | 'DESC') || 'DESC',
      referer: referer,
    });

    const itemsWithDisplayNames = await Promise.all(
      items.map(async (item) => {
        const [usernameDisplayName, refererDisplayName] = await Promise.all([
          this.accountDataPort.getDisplayName(item.username),
          item.referer ? this.accountDataPort.getDisplayName(item.referer) : Promise.resolve(undefined),
        ]);

        return {
          ...item,
          status: item.status,
          username_display_name: usernameDisplayName,
          referer_display_name: refererDisplayName,
        };
      })
    );

    return {
      items: itemsWithDisplayNames,
      totalCount,
      totalPages: Math.ceil(totalCount / (options.limit || 10)),
      currentPage: options.page || 1,
    };
  }

  public async registerParticipant(data: RegisterParticipantInputDTO): Promise<AccountDTO> {
    const result = await this.participantInteractor.registerParticipant(data);

    // Отправляем приветственное уведомление после успешной регистрации
    await this.participantNotificationService.sendWelcomeNotification(data.username);

    return new AccountDTO(result);
  }

  /**
   * Создать регистрационный платеж
   */
  public async createInitialPayment(data: CreateInitialPaymentInputDTO): Promise<GatewayPaymentDTO> {
    const result = await this.participantInteractor.createInitialPayment(data);
    const usernameCertificate = await this.userCertificateDomainPort.getCertificateByUsername(result.username);

    // Уведомление председателю шлём только если платёж создан вот сейчас.
    // Фронт может дёргать мутацию повторно (reload, immediate-watch на step и т.п.) —
    // в этих случаях интерактор поднимет уже существующий PENDING-платёж и
    // вернёт его с isNewlyCreated=false, и нотификация не задублируется.
    if (result.isNewlyCreated) {
      await this.participantNotificationService.sendNewInitialPaymentNotification(
        result.username,
        result.quantity.toFixed(2),
        result.symbol,
        result.coopname
      );
    }

    return result.toDTO(usernameCertificate);
  }

  public async generateParticipantApplication(
    data: ParticipantApplicationGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.participantInteractor.generateParticipantApplication(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }

  public async generateParticipantApplicationDecision(
    data: ParticipantApplicationDecisionGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.participantInteractor.generateParticipantApplicationDecision(data, options);
    return document as unknown as GeneratedDocumentDTO;
  }
}
