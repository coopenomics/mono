import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import type { FundProgramDomainInput } from '../../domain/actions/fund-program-domain-input.interface';
import type { RefreshProgramDomainInput } from '../../domain/actions/refresh-program-domain-input.interface';
import { APPENDIX_REPOSITORY, AppendixRepository } from '../../domain/repositories/appendix.repository';
import { GenerationConvertStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-convert-statement-document.dto';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { Cooperative } from 'cooptypes';

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
  async fundProgram(data: FundProgramDomainInput): Promise<TransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.fundProgram(data);
  }


  /**
   * Обновление CRPS пайщика в программе CAPITAL контракта
   */
  async refreshProgram(data: RefreshProgramDomainInput): Promise<TransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.refreshProgram(data);
  }

  /**
   * Подготавливает данные для генерации заявления о конвертации целевого паевого взноса.
   * appendix_hash подтягивается по (username, project_hash) из подтверждённого приложения к проекту.
   */
  async prepareGenerationConvertStatementData(
    data: GenerationConvertStatementGenerateDocumentInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<Cooperative.Registry.GenerationConvertStatement.Action> {
    const projectHash = data.project_hash;
    if (!projectHash) {
      throw new Error('project_hash обязателен для генерации заявления о конвертации');
    }

    const userAppendix = await this.appendixRepository.findConfirmedByUsernameAndProjectHash(
      currentUser.username,
      projectHash
    );

    if (!userAppendix) {
      throw new Error(`Не найдено подтверждённое приложение пользователя ${currentUser.username} для проекта ${projectHash}`);
    }

    return {
      ...data,
      appendix_hash: userAppendix.appendix_hash,
    } as Cooperative.Registry.GenerationConvertStatement.Action;
  }
}
