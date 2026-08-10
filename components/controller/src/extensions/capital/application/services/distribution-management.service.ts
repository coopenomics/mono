import { Inject, Injectable } from '@nestjs/common';
import { DistributionManagementInteractor } from '../use-cases/distribution-management.interactor';
import type { FundProgramInputDTO } from '../dto/distribution_management/fund-program-input.dto';
import type { RefreshProgramInputDTO } from '../dto/distribution_management/refresh-program-input.dto';
import type { TransactResult } from '@wharfkit/session';
import { GenerateDocumentOptionsInputDTO, GeneratedDocumentDTO, GenerateDocumentInputDTO } from '@coopenomics/extension-kit';
import { GenerationConvertStatementGenerateDocumentInputDTO } from '../documents-dto/generation-convert-statement-document.dto';
import { Cooperative } from 'cooptypes';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { DOCUMENT_PORT, type IDocumentPort } from '@coopenomics/innercoop';

/**
 * Сервис уровня приложения для управления распределением в CAPITAL
 * Обрабатывает запросы от DistributionManagementResolver
 */
@Injectable()
export class DistributionManagementService {
  constructor(
    private readonly distributionManagementInteractor: DistributionManagementInteractor,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort
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
   * Генерация заявления о конвертации целевого паевого взноса
   * (универсальный шаблон: в Цифровой Кошелёк и/или в программу «Благорост»)
   */
  async generateGenerationConvertStatement(
    data: GenerationConvertStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO,
    currentUser: IMonoAccount
  ): Promise<GeneratedDocumentDTO> {
    const enrichedData = await this.distributionManagementInteractor.prepareGenerationConvertStatementData(data, currentUser);
    const document = await this.documentPort.generate({
      data: {
        ...enrichedData,
        registry_id: Cooperative.Registry.GenerationConvertStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Генерация заявления о конвертации из благороста в основной кошелек
   */
  async generateCapitalizationToMainWalletConvertStatement(
    data: GenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    const document = await this.documentPort.generate({
      data: {
        ...data,
        registry_id: Cooperative.Registry.CapitalizationToMainWalletConvertStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }
}
