import { Injectable, Inject } from '@nestjs/common';
import type { ContributorDomainEntity } from '../../domain/entities/contributor.entity';
import { ContributorOutputDTO } from '../dto/participation_management/contributor.dto';
import { ContributorDocumentParametersDTO } from '../dto/participation_management/contributor-document-parameters.dto';
import { Cooperative } from 'cooptypes';
import { ProgramWalletDTO } from '~/application/wallet/dto/program-wallet.dto';
import { WALLET_DOMAIN_PORT, type WalletDomainPort } from '~/domain/wallet/ports/wallet-domain.port';
import { DOCUMENT_PORT, type IDocumentPort } from '@coopenomics/innercoop';
import { USER_DATA_PORT, type IUserDataPort } from '@coopenomics/innercoop';
import { ProgramType, getProgramId } from '@coopenomics/innercoop';

/**
 * Сервис для маппинга доменных сущностей участников в DTO
 */
@Injectable()
export class ContributorMapperService {
  constructor(
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(USER_DATA_PORT) private readonly udataRepository: IUserDataPort,
    @Inject(WALLET_DOMAIN_PORT) private readonly walletDomainPort: WalletDomainPort
  ) {}

  /**
   * Маппинг доменной сущности участника в DTO
   */
  async mapContributorToOutputDTO(contributor: ContributorDomainEntity): Promise<ContributorOutputDTO> {
    // Асинхронная обработка контракта с использованием DocumentAggregationService
    const contract = contributor.contract
      ? await this.documentPort.buildAggregate(contributor.contract)
      : null;

    // Загружаем параметры документов из UData и программные кошельки параллельно
    const [document_parameters, main_wallet, generation_wallet, blagorost_wallet] = await Promise.all([
      this.loadDocumentParameters(contributor.coopname, contributor.username),
      this.loadProgramWallet(contributor.coopname, contributor.username, ProgramType.MAIN),
      this.loadProgramWallet(contributor.coopname, contributor.username, ProgramType.GENERATOR),
      this.loadProgramWallet(contributor.coopname, contributor.username, ProgramType.BLAGOROST),
    ]);

    return {
      ...contributor,
      contract,
      document_parameters,
      main_wallet,
      generation_wallet,
      blagorost_wallet,
    };
  }

  /**
   * Загружает параметры документов участника из UData
   */
  private async loadDocumentParameters(
    coopname: string,
    username: string
  ): Promise<ContributorDocumentParametersDTO> {
    // Загружаем все необходимые параметры параллельно
    const [
      blagorost_contributor_contract_number,
      blagorost_contributor_contract_created_at,
      generator_agreement_number,
      generator_agreement_created_at,
      blagorost_agreement_number,
      blagorost_agreement_created_at,
      blagorost_storage_agreement_number,
      blagorost_storage_agreement_created_at,
    ] = await Promise.all([
      this.udataRepository.get(coopname, username, Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER),
      this.udataRepository.get(coopname, username, Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT),
      this.udataRepository.get(coopname, username, Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER),
      this.udataRepository.get(coopname, username, Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT),
      this.udataRepository.get(coopname, username, Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER),
      this.udataRepository.get(coopname, username, Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_CREATED_AT),
      this.udataRepository.get(coopname, username, Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_NUMBER),
      this.udataRepository.get(coopname, username, Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_CREATED_AT),
    ]);

    return {
      blagorost_contributor_contract_number: blagorost_contributor_contract_number?.value,
      blagorost_contributor_contract_created_at: blagorost_contributor_contract_created_at?.value,
      generator_agreement_number: generator_agreement_number?.value,
      generator_agreement_created_at: generator_agreement_created_at?.value,
      blagorost_agreement_number: blagorost_agreement_number?.value,
      blagorost_agreement_created_at: blagorost_agreement_created_at?.value,
      blagorost_storage_agreement_number: blagorost_storage_agreement_number?.value,
      blagorost_storage_agreement_created_at: blagorost_storage_agreement_created_at?.value,
    };
  }

  /**
   * Загружает программный кошелек участника для указанного типа программы
   * Возвращает null, если кошелек не найден
   */
  private async loadProgramWallet(
    coopname: string,
    username: string,
    programType: ProgramType
  ): Promise<ProgramWalletDTO | null> {
    try {
      const program_id = getProgramId(programType);
      const wallet = await this.walletDomainPort.getProgramWallet({
        coopname,
        username,
        program_id,
      });

      return wallet ? ProgramWalletDTO.fromDomain(wallet) : null;
    } catch (error) {
      // Если кошелек не найден, возвращаем null
      return null;
    }
  }
}
