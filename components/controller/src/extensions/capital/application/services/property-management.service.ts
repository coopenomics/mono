import { Inject, Injectable } from '@nestjs/common';
import { PropertyManagementInteractor } from '../use-cases/property-management.interactor';
import type { CreateProgramPropertyInputDTO } from '../dto/property_management/create-program-property-input.dto';
import type { CreateProjectPropertyInputDTO } from '../dto/property_management/create-project-property-input.dto';
import type { SignProgramPropertyActInputDTO } from '../dto/property_management/sign-program-property-act-input.dto';
import type { GenerateProgramPropertyActInputDTO } from '../dto/property_management/generate-program-property-act-input.dto';
import type { ProgramPropertyFilterInputDTO } from '../dto/property_management/program-property-filter.input';
import type { ProgramPropertyOutputDTO } from '../dto/property_management/program-property.dto';
import type {
  CapitalizationPropertyInvestDecisionGenerateDocumentInputDTO,
  CapitalizationPropertyInvestStatementGenerateDocumentInputDTO,
} from '../documents-dto/capitalization-property-invest-document.dto';
import type { ProgramPropertyDomainEntity } from '../../domain/entities/program-property.entity';
import {
  GenerateDocumentOptionsInputDTO,
  GeneratedDocumentDTO,
  GenerateDocumentInputDTO,
  type PaginationInputDTO,
  type PaginationResult,
  CurrencyValidationUtil,
  verifySignedDocumentAgainstStoredDraft,
} from '@coopenomics/extension-kit';
import { t } from '../../i18n';
import { Registry } from '@coopenomics/docs-templates';
import { DOCUMENT_PORT, type IDocumentPort,
  type InnerTransactResult,
} from '@coopenomics/innercoop';

/**
 * Сервис уровня приложения для управления имуществом CAPITAL
 * Обрабатывает запросы от PropertyManagementResolver
 */
@Injectable()
export class PropertyManagementService {
  constructor(
    private readonly propertyManagementInteractor: PropertyManagementInteractor,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort
  ) {}

  /**
   * Создание программного имущественного взноса в CAPITAL контракте
   */
  async createProgramProperty(data: CreateProgramPropertyInputDTO): Promise<InnerTransactResult> {
    // Подписанное заявление — ровно то, что собрала фабрика: позицию и оценку
    // сервер берёт из его меты, подменить их после сборки нельзя.
    CurrencyValidationUtil.validateCurrencySymbol(data.statement.meta.property_amount, t('capital.currencyField.propertyAmount'));
    await verifySignedDocumentAgainstStoredDraft((docHash) => this.documentPort.getByHash(docHash), data.statement);
    return await this.propertyManagementInteractor.createProgramProperty(data);
  }

  /**
   * Подпись пайщиком акта приёма-передачи имущества
   */
  async signProgramPropertyAct(data: SignProgramPropertyActInputDTO): Promise<InnerTransactResult> {
    await verifySignedDocumentAgainstStoredDraft((docHash) => this.documentPort.getByHash(docHash), data.act);
    return await this.propertyManagementInteractor.signProgramPropertyAct(data);
  }

  /**
   * Паевые взносы имуществом с документами процесса
   */
  async getProgramProperties(
    filter?: ProgramPropertyFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ProgramPropertyOutputDTO>> {
    const result = await this.propertyManagementInteractor.getProgramProperties(filter, options);
    const items = await Promise.all(result.items.map((item) => this.mapProgramPropertyToOutputDTO(item)));
    return { ...result, items };
  }

  /**
   * Создание проектного имущественного взноса в CAPITAL контракте
   */
  async createProjectProperty(data: CreateProjectPropertyInputDTO): Promise<InnerTransactResult> {
    return await this.propertyManagementInteractor.createProjectProperty(data);
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация заявления об инвестировании имуществом в генерацию
   */
  async generateGenerationPropertyInvestStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        registry_id: Registry.GenerationPropertyInvestStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация решения об инвестировании имуществом в генерацию
   */
  async generateGenerationPropertyInvestDecision(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        registry_id: Registry.GenerationPropertyInvestDecision.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация акта об инвестировании имуществом в генерацию
   */
  async generateGenerationPropertyInvestAct(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        registry_id: Registry.GenerationPropertyInvestAct.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация заявления об инвестировании имуществом в благорост
   */
  async generateCapitalizationPropertyInvestStatement(
    data: CapitalizationPropertyInvestStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        registry_id: Registry.CapitalizationPropertyInvestStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация решения об инвестировании имуществом в благорост
   */
  async generateCapitalizationPropertyInvestDecision(
    data: CapitalizationPropertyInvestDecisionGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        registry_id: Registry.CapitalizationPropertyInvestDecision.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Акт приёма-передачи имущества в «Благорост». Тело акта сохраняется в
   * хранилище документов: председатель ставит вторую подпись на этот же
   * документ в запросах одобрений, исходник берётся из хранилища документов по хэшу.
   */
  async generateCapitalizationPropertyInvestAct(
    data: GenerateProgramPropertyActInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const actData = await this.propertyManagementInteractor.buildActGenerationData(data);
    const document = await this.documentPort.generate({
      data: actData,
      options: { ...(options ?? {}), skip_save: false },
    });
    return document as GeneratedDocumentDTO;
  }

  private async mapProgramPropertyToOutputDTO(property: ProgramPropertyDomainEntity): Promise<ProgramPropertyOutputDTO> {
    const [statement, authorization, act] = await Promise.all([
      property.statement ? this.documentPort.buildAggregate(property.statement) : Promise.resolve(null),
      property.authorization ? this.documentPort.buildAggregate(property.authorization) : Promise.resolve(null),
      property.act ? this.documentPort.buildAggregate(property.act) : Promise.resolve(null),
    ]);
    const position = this.propertyManagementInteractor.positionOf(property);

    return {
      _id: property._id,
      id: property.id,
      block_num: property.block_num,
      present: property.present,
      status: property.status,
      property_hash: property.property_hash,
      coopname: property.coopname,
      username: property.username,
      blockchain_status: property.blockchain_status,
      property_amount: property.property_amount,
      property_description: property.property_description,
      property_name: position.property_name,
      property_details: position.property_description,
      property_quantity: position.property_quantity,
      property_unit: position.property_unit,
      created_at: property.created_at,
      statement: statement ?? undefined,
      authorization: authorization ?? undefined,
      act: act ?? undefined,
      _created_at: property._created_at,
      _updated_at: property._updated_at,
    } as ProgramPropertyOutputDTO;
  }

}
