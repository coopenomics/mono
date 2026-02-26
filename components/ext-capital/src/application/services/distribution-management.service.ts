import { Injectable } from '@nestjs/common';
import { DistributionManagementInteractor } from '../use-cases/distribution-management.interactor';
import type { FundProgramInputDTO } from '../dto/distribution_management/fund-program-input.dto';
import type { RefreshProgramInputDTO } from '../dto/distribution_management/refresh-program-input.dto';
import type { TransactResult } from '@wharfkit/session';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerationToMainWalletConvertStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-to-main-wallet-convert-statement-document.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';
import type { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';

/**
 * Сервис уровня приложения для управления распределением в CAPITAL
 * Обрабатывает запросы от DistributionManagementResolver
 */
@Injectable()
export class DistributionManagementService {
  constructor(
    private readonly distributionManagementInteractor: DistributionManagementInteractor,
    private readonly documentInteractor: DocumentInteractor
  ) {}

  /**
   * Финансирование программы в CAPITAL контракте
   */
  async fundProgram(data: FundProgramInputDTO): Promise<TransactResult> {
    return await this.distributionManagementInteractor.fundProgram(data);
  }


  /**
   * Обновление CRPS пайщика в программе CAPITAL контракта
   */
  async refreshProgram(data: RefreshProgramInputDTO): Promise<TransactResult> {
    return await this.distributionManagementInteractor.refreshProgram(data);
  }


  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация заявления о конвертации из генерации в основной кошелек
   */
  async generateGenerationToMainWalletConvertStatement(
    data: GenerationToMainWalletConvertStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GenerationToMainWalletConvertStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация заявления о конвертации из генерации в проектный кошелек
   */
  async generateGenerationToProjectConvertStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GenerationToProjectConvertStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация заявления о конвертации из генерации в капитализацию
   */
  async generateGenerationToCapitalizationConvertStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.GenerationToCapitalizationConvertStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация заявления о конвертации из капитализации в основной кошелек
   */
  async generateCapitalizationToMainWalletConvertStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.CapitalizationToMainWalletConvertStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
