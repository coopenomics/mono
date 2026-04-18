import { Cooperative } from 'cooptypes';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import type { AddParticipantDomainInterface } from '~/domain/participant/interfaces/add-participant-domain.interface';
import type { RegisterAccountDomainInterface } from '~/domain/account/interfaces/register-account-input.interface';
import { AccountDomainService } from '~/domain/account/services/account-domain.service';
import type { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import config from '~/config/config';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import type { RegisterParticipantDomainInterface } from '~/domain/participant/interfaces/register-participant-domain.interface';
import { CANDIDATE_REPOSITORY, CandidateRepository } from '~/domain/account/repository/candidate.repository';
import { userStatus } from '~/types/user.types';
import { HttpApiError } from '~/utils/httpApiError';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import { sha256 } from '~/utils/sha256';
import http from 'http-status';
import { PublicKey, Signature } from '@wharfkit/antelope';
import { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { GatewayInteractorPort, GATEWAY_INTERACTOR_PORT } from '~/domain/wallet/ports/gateway-interactor.port';
import type { CreateInitialPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-initial-payment-input-domain.interface';
import { PaymentDomainEntity } from '~/domain/gateway/entities/payment-domain.entity';
import {
  NOTIFICATION_DOMAIN_SERVICE,
  NotificationDomainService,
} from '~/domain/notification/services/notification-domain.service';
import { NotificationSenderService } from '~/application/notification/services/notification-sender.service';
import { Workflows } from '@coopenomics/notifications';
import {
  DOCUMENT_VALIDATION_SERVICE,
  DocumentValidationService,
  type IDocumentToValidate,
} from '~/domain/document/services/document-validation.service';
import {
  AgreementConfigurationService,
  AGREEMENT_CONFIGURATION_SERVICE,
} from '~/domain/registration/services/agreement-configuration.service';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { DocumentType, AgreementId } from '~/domain/registration/enum';
import { EventsService } from '~/infrastructure/events/events.service';

@Injectable()
export class ParticipantInteractor {
  private readonly logger = new Logger(ParticipantInteractor.name);

  constructor(
    private readonly documentDomainService: DocumentDomainService,
    private readonly accountDomainService: AccountDomainService,
    @Inject(CANDIDATE_REPOSITORY) private readonly candidateRepository: CandidateRepository,
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly gatewayInteractorPort: GatewayInteractorPort,
    @Inject(NOTIFICATION_DOMAIN_SERVICE) private readonly notificationDomainService: NotificationDomainService,
    private readonly notificationSenderService: NotificationSenderService,
    @Inject(forwardRef(() => DOCUMENT_VALIDATION_SERVICE))
    private readonly documentValidationService: DocumentValidationService,
    @Inject(AGREEMENT_CONFIGURATION_SERVICE)
    private readonly agreementConfigurationService: AgreementConfigurationService,
    private readonly tokenApplicationService: TokenApplicationService,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    private readonly eventsService: EventsService
  ) {}

  async generateParticipantApplication(
    data: Cooperative.Registry.ParticipantApplication.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.ParticipantApplication.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  async generateParticipantApplicationDecision(
    data: Cooperative.Registry.DecisionOfParticipantApplication.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.DecisionOfParticipantApplication.registry_id;
    return await this.documentDomainService.generateDocument({ data, options });
  }

  /**
   * Проверяет подпись документа
   * @private
   */
  private verifyDocumentSignature(public_key: string, document: ISignedDocumentDomainInterface): void {
    const { signatures } = document;
    const doc_public_key = signatures[0].public_key;
    const signature = signatures[0].signature;
    const signed_hash = signatures[0].signed_hash;
    const publicKeyObj = PublicKey.from(doc_public_key);
    const signatureObj = Signature.from(signature);

    const verified: boolean = signatureObj.verifyDigest(signed_hash, publicKeyObj);
    if (!verified) {
      throw new HttpApiError(http.INTERNAL_SERVER_ERROR, 'Недействительная подпись');
    }

    if (public_key !== doc_public_key) throw new HttpApiError(http.BAD_REQUEST, 'Несовпадение публичных ключей');
  }

  async registerParticipant(data: RegisterParticipantDomainInterface): Promise<AccountDomainEntity> {
    // Получаем информацию о пользователе
    const user = await this.userDomainService.getUserByUsername(data.username);

    if (!user) {
      throw new HttpApiError(http.NOT_FOUND, 'Пользователь не найден');
    }

    if (user.status !== userStatus['1_Created'] && user.status !== userStatus['2_Joined']) {
      throw new HttpApiError(http.NOT_FOUND, 'Пользователь уже вступил в кооператив');
    }

    // Получаем кандидата из репозитория
    const candidate = await this.candidateRepository.findByUsername(data.username);

    if (!candidate) {
      this.logger.error(`Кандидат с именем ${data.username} не найден`);
      throw new HttpApiError(http.NOT_FOUND, 'Кандидат не найден');
    }

    // ПРОВЕРКА 1: Сверка типа аккаунта
    // Проверяем, что в заявлении указан тот же тип аккаунта, что и у кандидата
    const statementMeta = data.statement.meta as any;
    if (statementMeta?.participant_data?.type && statementMeta.participant_data.type !== candidate.type) {
      throw new HttpApiError(
        http.BAD_REQUEST,
        `Тип аккаунта в заявлении (${statementMeta.participant_data.type}) не совпадает с типом зарегистрированного кандидата (${candidate.type})`
      );
    }

    // ПРОВЕРКА 1: Получаем список всех требуемых соглашений из конфигурации
    // Это единственный источник истины - конфигурация определяет что требуется
    const requiredAgreements = this.agreementConfigurationService.getRequiredAgreementIds(
      candidate.type as AccountType,
      config.coopname,
      data.program_key
    );

    // ПРОВЕРКА 2: Подготавливаем структуру для валидации документов динамически на основе конфигурации
    const documentsToValidate: IDocumentToValidate[] = [
      // Заявление всегда обязательно
      { id: 'statement', document: data.statement },
    ];

    // Проверяем наличие и валидируем все требуемые соглашения из конфигурации
    const missingAgreements: string[] = [];
    for (const agreementId of requiredAgreements) {
      const agreementData = data[agreementId];
      if (!agreementData) {
        missingAgreements.push(agreementId);
      } else {
        // Добавляем документ в список для валидации
        documentsToValidate.push({ id: agreementId, document: agreementData });
      }
    }

    if (missingAgreements.length > 0) {
      throw new HttpApiError(
        http.BAD_REQUEST,
        `Отсутствуют обязательные соглашения для типа аккаунта "${candidate.type}": ${missingAgreements.join(', ')}`
      );
    }

    // ПРОВЕРКА 3: Валидируем все собранные документы с проверкой оригиналов в базе
    const validationResults = await this.documentValidationService.validateRegistrationDocuments(documentsToValidate);

    if (!this.documentValidationService.allDocumentsValid(validationResults)) {
      const errors = this.documentValidationService.getErrorMessages(validationResults);
      this.logger.error(`Ошибка валидации документов: ${errors.join('; ')}`);
      throw new HttpApiError(http.BAD_REQUEST, `Ошибка валидации документов: ${errors.join('; ')}`);
    }

    // ПРОВЕРКА 4: Проверка линкованных документов в заявлении на основе конфигурации
    const statementLinks = (data.statement.meta as any)?.links || [];

    // Получаем список документов, которые должны быть линкованы, из конфигурации
    const linkedAgreements = this.agreementConfigurationService.getLinkedAgreements(
      candidate.type as AccountType,
      config.coopname,
      data.program_key
    );

    const expectedLinks: string[] = [];
    const missingLinkedDocs: string[] = [];

    for (const agreement of linkedAgreements) {
      const doc = data[agreement.id];
      if (doc) {
        expectedLinks.push(doc.doc_hash);
      } else {
        missingLinkedDocs.push(agreement.id);
      }
    }

    if (missingLinkedDocs.length > 0) {
      this.logger.warn(`Отсутствуют документы для линковки: ${missingLinkedDocs.join(', ')}`);
    }

    // Проверяем, что все ожидаемые хеши присутствуют в заявлении
    const missingLinks = expectedLinks.filter((hash) => !statementLinks.includes(hash));

    if (missingLinks.length > 0) {
      throw new HttpApiError(
        http.BAD_REQUEST,
        `В заявлении отсутствуют ссылки на следующие документы: ${missingLinks.join(', ')}`
      );
    }

    // Сохраняем заявление
    await this.candidateRepository.saveDocument(data.username, DocumentType.STATEMENT, data.statement);

    // Сохраняем все требуемые соглашения динамически на основе конфигурации
    for (const agreementId of requiredAgreements) {
      const doc = data[agreementId];
      if (doc) {
        // Преобразуем agreementId в соответствующий DocumentType
        const documentType = this.mapAgreementIdToDocumentType(agreementId);
        if (documentType) {
          await this.candidateRepository.saveDocument(
            data.username,
            documentType,
            doc
          );
        }
      }
    }

    await this.candidateRepository.update(data.username, {
      braname: data.braname,
      program_key: data.program_key,
    });

    // Обновляем статус пользователя
    await this.userDomainService.updateUserByUsername(data.username, {
      status: userStatus['2_Joined'],
    });

    // Собираем хэши оферт для передачи в событии
    const offerHashes: { blagorost_offer_hash?: string; generator_offer_hash?: string } = {};

    // Получаем хэш blagorost_offer если он был сохранен
    if (data.blagorost_offer) {
      offerHashes.blagorost_offer_hash = data.blagorost_offer.doc_hash;
    }

    // Получаем хэш generator_offer если он был сохранен
    if (data.generator_offer) {
      offerHashes.generator_offer_hash = data.generator_offer.doc_hash;
    }

    // Эмитим событие о регистрации участника для обработки расширениями
    this.eventsService.emit('participant::registered', {
      username: data.username,
      program_key: data.program_key,
      braname: data.braname,
      account_type: candidate.type,
      ...offerHashes, // Передаем хэши оферт
    });

    this.logger.log(`Успешно зарегистрированы документы для кандидата ${data.username}`);

    return await this.accountDomainService.getAccount(data.username);
  }

  /**
   * Преобразует AgreementId в соответствующий DocumentType
   */
  private mapAgreementIdToDocumentType(agreementId: string): DocumentType | null {
    switch (agreementId) {
      case AgreementId.SIGNATURE_AGREEMENT:
        return DocumentType.SIGNATURE_AGREEMENT;
      case AgreementId.WALLET_AGREEMENT:
        return DocumentType.WALLET_AGREEMENT;
      case AgreementId.USER_AGREEMENT:
        return DocumentType.USER_AGREEMENT;
      case AgreementId.PRIVACY_AGREEMENT:
        return DocumentType.PRIVACY_AGREEMENT;
      case AgreementId.BLAGOROST_OFFER:
        return DocumentType.BLAGOROST_OFFER;
      case AgreementId.GENERATOR_OFFER:
        return DocumentType.GENERATOR_OFFER;
      default:
        this.logger.warn(`Неизвестный agreementId: ${agreementId}`);
        return null;
    }
  }

  async addParticipant(data: AddParticipantDomainInterface): Promise<AccountDomainEntity> {
    const newAccount: RegisterAccountDomainInterface = {
      ...data,
      public_key: '',
      username: data.username,
    };

    await this.accountDomainService.addProviderAccount(newAccount);

    // Настраиваем подписчика NOVU для участника
    try {
      await this.accountDomainService.setupNotificationSubscriber(data.username, 'участника');
    } catch (error: any) {
      this.logger.error(`Ошибка настройки подписчика NOVU для участника ${data.username}: ${error.message}`, error.stack);
    }

    await this.accountDomainService.addParticipantAccount({
      referer: data.referer ? data.referer : '',
      coopname: config.coopname,
      meta: '',
      username: data.username,
      type: data.type,
      created_at: data.created_at,
      initial: data.initial,
      minimum: data.minimum,
      spread_initial: data.spread_initial,
      registration_hash: sha256(data.username),
    });

    //TODO move it to hexagon services

    const inviteEmail = normalizeUserEmail(data.email);
    const user = await this.userDomainService.getUserByEmail(inviteEmail);
    if (!user) {
      throw new HttpApiError(http.NOT_FOUND, 'Пользователь не найден');
    }
    const token = await this.tokenApplicationService.generateInviteToken(inviteEmail, user.id);
    const inviteUrl = `${config.frontend_url}/${config.coopname}/auth/invite?token=${token}`;

    await this.notificationSenderService.sendNotificationToUser(data.username, Workflows.Invite.id, { inviteUrl });

    return this.accountDomainService.getAccount(data.username);
  }

  /**
   * Создать регистрационный платеж
   */
  async createInitialPayment(data: CreateInitialPaymentInputDomainInterface): Promise<PaymentDomainEntity> {
    return await this.gatewayInteractorPort.createInitialPayment(data);
  }
}
