import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { FundProgramDomainInput } from '../../domain/actions/fund-program-domain-input.interface';
import type { RefreshProgramDomainInput } from '../../domain/actions/refresh-program-domain-input.interface';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import { GenerationConvertStatementGenerateDocumentInputDTO } from '../documents-dto/generation-convert-statement-document.dto';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { Cooperative } from 'cooptypes';
import type { InnerTransactResult } from '@coopenomics/innercoop';
import { DomainError } from '@coopenomics/extension-kit';

/**
 * Интерактор домена для распределения средств в CAPITAL контракте
 * Обрабатывает действия связанные с финансированием и обновлением CRPS
 */
@Injectable()
export class DistributionManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(APPENDIX_REPOSITORY)
    private readonly appendixRepository: AppendixRepository
  ) {}

  /**
   * Финансирование программы в CAPITAL контракте
   */
  async fundProgram(data: FundProgramDomainInput): Promise<InnerTransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.fundProgram(data);
  }


  /**
   * Обновление CRPS пайщика в программе CAPITAL контракта
   */
  async refreshProgram(data: RefreshProgramDomainInput): Promise<InnerTransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.refreshProgram(data);
  }

  /**
   * Подготавливает данные для генерации заявления о конвертации целевого паевого взноса.
   * appendix_hash подтягивается по (username, project_hash) из подтверждённого приложения к проекту.
   */
  async prepareGenerationConvertStatementData(
    data: GenerationConvertStatementGenerateDocumentInputDTO,
    currentUser: IMonoAccount
  ): Promise<Cooperative.Registry.GenerationConvertStatement.Action> {
    const projectHash = data.project_hash;
    if (!projectHash) {
      throw DomainError.internal('CAPITAL_CONVERSION_PROJECT_HASH_REQUIRED');
    }

    const userAppendix = await this.appendixRepository.findConfirmedByUsernameAndProjectHash(
      currentUser.username,
      projectHash
    );

    if (!userAppendix) {
      throw DomainError.internal('CAPITAL_CONFIRMED_APPENDIX_NOT_FOUND', { username: currentUser.username, projectHash });
    }

    return {
      ...data,
      appendix_hash: userAppendix.appendix_hash,
    } as Cooperative.Registry.GenerationConvertStatement.Action;
  }
}
