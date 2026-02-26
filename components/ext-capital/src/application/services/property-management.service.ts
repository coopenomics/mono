import { Injectable } from '@nestjs/common';
import { PropertyManagementInteractor } from '../use-cases/property-management.interactor';
import type { CreateProgramPropertyInputDTO } from '../dto/property_management/create-program-property-input.dto';
import type { CreateProjectPropertyInputDTO } from '../dto/property_management/create-project-property-input.dto';
import type { TransactResult } from '@wharfkit/session';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';

/**
 * Сервис уровня приложения для управления имуществом CAPITAL
 * Обрабатывает запросы от PropertyManagementResolver
 */
@Injectable()
export class PropertyManagementService {
  constructor(
    private readonly propertyManagementInteractor: PropertyManagementInteractor,
    private readonly documentInteractor: DocumentInteractor
  ) {}

  /**
   * Создание программного имущественного взноса в CAPITAL контракте
   */
  async createProgramProperty(data: CreateProgramPropertyInputDTO): Promise<TransactResult> {
    return await this.propertyManagementInteractor.createProgramProperty(data);
  }

  /**
   * Создание проектного имущественного взноса в CAPITAL контракте
   */
  async createProjectProperty(data: CreateProjectPropertyInputDTO): Promise<TransactResult> {
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
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GenerationPropertyInvestStatement.registry_id,
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
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GenerationPropertyInvestDecision.registry_id,
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
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GenerationPropertyInvestAct.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация заявления об инвестировании имуществом в капитализацию
   */
  async generateCapitalizationPropertyInvestStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.CapitalizationPropertyInvestStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация решения об инвестировании имуществом в капитализацию
   */
  async generateCapitalizationPropertyInvestDecision(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.CapitalizationPropertyInvestDecision.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация акта об инвестировании имуществом в капитализацию
   */
  async generateCapitalizationPropertyInvestAct(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.CapitalizationPropertyInvestAct.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
