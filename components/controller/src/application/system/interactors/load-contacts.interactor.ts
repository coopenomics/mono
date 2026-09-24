import { Injectable, Inject } from '@nestjs/common';
import type { CooperativeContactsDomainInterface } from '~/domain/system/interfaces/cooperative-contacts-domain.interface';
import { RegistratorContract, type Cooperative } from 'cooptypes';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import config from '~/config/config';
import logger from '~/config/logger';
import { BLOCKCHAIN_PORT, BlockchainPort } from '~/domain/common/ports/blockchain.port';
import { Name } from '@wharfkit/antelope';
import { DomainError } from '@coopenomics/extension-kit';

@Injectable()
export class LoadContactsInteractor {
  constructor(
    @Inject(BLOCKCHAIN_PORT) private readonly blockchainPort: BlockchainPort,
    @Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort
  ) {}

  async execute(): Promise<CooperativeContactsDomainInterface> {
    const cooperative: Cooperative.Model.ICooperativeData | null = await this.generatorPort.constructCooperative(
      config.coopname
    );

    if (!cooperative) throw DomainError.badRequest('SYSTEM_COOPERATIVE_NOT_FOUND');

    const coopAccount = await this.blockchainPort.getSingleRow(
      RegistratorContract.contractName.production,
      RegistratorContract.contractName.production,
      RegistratorContract.Tables.Accounts.tableName,
      Name.from(config.coopname)
    );

    if (!coopAccount) throw DomainError.badRequest('SYSTEM_ACCOUNT_NOT_FOUND');

    let meta: Cooperative.Users.IAccountMeta = { phone: cooperative?.phone, email: cooperative?.email };

    if (coopAccount.meta) {
      try {
        meta = JSON.parse(coopAccount.meta);
      } catch (e: any) {
        logger.warn(`Ошибка при получении контактов: ${e.message}`);
      }
    }

    return {
      full_name: cooperative?.full_name,
      full_address: cooperative?.full_address,
      details: cooperative?.details,
      phone: meta.phone || cooperative?.phone,
      email: meta.email || cooperative?.email,
      // description: cooperative?.description,
      chairman: {
        first_name: cooperative?.chairman.first_name,
        last_name: cooperative?.chairman.last_name,
        middle_name: cooperative?.chairman.middle_name,
      },
    };
  }
}
