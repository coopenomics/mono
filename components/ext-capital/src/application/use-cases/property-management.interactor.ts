import { Injectable, Inject } from '@nestjs/common';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import type { TransactResult } from '@wharfkit/session';
import type { CreateProgramPropertyDomainInput } from '../../domain/actions/create-program-property-domain-input.interface';
import type { CreateProjectPropertyDomainInput } from '../../domain/actions/create-project-property-domain-input.interface';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';

/**
 * Интерактор домена для управления имущественными взносами CAPITAL контракта
 * Обрабатывает действия связанные с внесением имущества в проекты и программы
 */
@Injectable()
export class PropertyManagementInteractor {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils
  ) {}

  /**
   * Создание проектного имущественного взноса в CAPITAL контракте
   */
  async createProjectProperty(data: CreateProjectPropertyDomainInput): Promise<TransactResult> {
    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.createProjectProperty(data);
  }

  /**
   * Создание программного имущественного взноса в CAPITAL контракте
   */
  async createProgramProperty(data: CreateProgramPropertyDomainInput): Promise<TransactResult> {
    // Преобразовываем доменный документ в формат блокчейна
    const blockchainData = {
      ...data,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };

    // Вызываем блокчейн порт
    return await this.capitalBlockchainPort.createProgramProperty(blockchainData);
  }
}
