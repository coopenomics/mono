import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { Throttle } from '@nestjs/throttler';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { CandidateOutputDTO } from '../dto/candidate.dto';
import { CandidateFilterInputDTO } from '../dto/candidate-filter.dto';
import { RegistrationService } from '../services/registration.service';
import { GenerateRegistrationDocumentsInputDTO } from '../dto/generate-registration-documents-input.dto';
import { GenerateRegistrationDocumentsOutputDTO } from '../dto/generate-registration-documents-output.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { ParticipantApplicationGenerateDocumentInputDTO } from '~/application/document/documents-dto/participant-application-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { ParticipantApplicationDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/participant-application-decision-document.dto';
import { AccountDTO } from '~/application/account/dto/account.dto';
import { RegisterParticipantInputDTO } from '../dto/register-participant-input.dto';
import { GatewayPaymentDTO } from '~/application/gateway/dto/gateway-payment.dto';
import { CreateInitialPaymentInputDTO } from '~/application/gateway/dto/create-initial-payment-input.dto';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { RegistrationAgreementDTO } from '../dto/registration-agreement.dto';
import { AccountType } from '~/application/account/enum/account-type.enum';

// Пагинированные результаты
const paginatedCandidatesResult = createPaginationResult(CandidateOutputDTO, 'PaginatedCandidates');

/**
 * GraphQL резолвер для запросов регистрации
 */
@Resolver()
export class RegistrationResolver {
  constructor(private readonly registrationService: RegistrationService) {}

  /**
   * Получение всех кандидатов с пагинацией
   */
  @Query(() => paginatedCandidatesResult, {
    name: 'candidates',
    description: 'Получение списка кандидатов с пагинацией, отсортированных по дате регистрации',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getCandidates(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('filter', { nullable: true }) filter?: CandidateFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<CandidateOutputDTO>> {
    return await this.registrationService.getCandidates(currentUser, filter, options);
  }

  /**
   * Список оферт, требуемых при регистрации для данного типа аккаунта
   * (и опционально программы). Сливает платформенные + extension-
   * зарегистрированные через AgreementRegistry.
   */
  @Query(() => [RegistrationAgreementDTO], {
    name: 'getRegistrationAgreements',
    description:
      'Получить список оферт для регистрации пайщика заданного типа аккаунта и (опционально) программы. Сливает базовые платформенные оферты с теми, что зарегистрировали расширения.',
  })
  async getRegistrationAgreements(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('account_type', { type: () => AccountType }) accountType: AccountType,
    @Args('program_key', { type: () => String, nullable: true }) programKey?: string
  ): Promise<RegistrationAgreementDTO[]> {
    return this.registrationService.getRegistrationAgreements(coopname, accountType, programKey);
  }

  @Mutation(() => GenerateRegistrationDocumentsOutputDTO, {
    name: 'generateRegistrationDocuments',
    description:
      'Генерирует пакет документов для регистрации пайщика. Возвращает список документов с метаданными для отображения на фронтенде.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateRegistrationDocuments(
    @Args('data', { type: () => GenerateRegistrationDocumentsInputDTO })
    data: GenerateRegistrationDocumentsInputDTO
  ): Promise<GenerateRegistrationDocumentsOutputDTO> {
    return this.registrationService.generateRegistrationDocuments(data);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateParticipantApplication',
    description: 'Сгенерировать документ заявления о вступлении в кооператив.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateParticipantApplication(
    @Args('data', { type: () => ParticipantApplicationGenerateDocumentInputDTO })
    data: ParticipantApplicationGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.registrationService.generateParticipantApplication(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateParticipantApplicationDecision',
    description: 'Сгенерировать документ протокол решения собрания совета',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateParticipantApplicationDecision(
    @Args('data', { type: () => ParticipantApplicationDecisionGenerateDocumentInputDTO })
    data: ParticipantApplicationDecisionGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.registrationService.generateParticipantApplicationDecision(data, options);
  }

  @Mutation(() => AccountDTO, {
    name: 'registerParticipant',
    description:
      'Зарегистрировать заявление и подписанные положения, подготовив пакет документов к отправке в совет на голосование после поступления оплаты.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async registerParticipant(
    @Args('data', { type: () => RegisterParticipantInputDTO })
    data: RegisterParticipantInputDTO
  ): Promise<AccountDTO> {
    return this.registrationService.registerParticipant(data);
  }

  @Mutation(() => GatewayPaymentDTO, {
    name: 'createInitialPayment',
    description:
      'Создание объекта регистрационного платежа производится мутацией createInitialPayment. Выполнение мутации возвращает идентификатор платежа и данные для его совершения в зависимости от выбранного платежного провайдера.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async createInitialPayment(
    @Args('data', { type: () => CreateInitialPaymentInputDTO }) data: CreateInitialPaymentInputDTO
  ): Promise<GatewayPaymentDTO> {
    return await this.registrationService.createInitialPayment(data);
  }
}
