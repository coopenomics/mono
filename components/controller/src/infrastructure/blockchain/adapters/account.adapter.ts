import { BadGatewayException, HttpStatus, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { HttpApiError } from '~/utils/httpApiError';
import { BlockchainService } from '../blockchain.service';
import { GatewayContract, RegistratorContract, SovietContract, WalletContract } from 'cooptypes';
import type { BlockchainAccountInterface } from '~/types/shared';
import type { AccountBlockchainPort } from '~/domain/account/interfaces/account-blockchain.port';
import { VaultDomainService, VAULT_DOMAIN_SERVICE } from '~/domain/vault/services/vault-domain.service';
import { Name } from '@wharfkit/antelope';
import config from '~/config/config';
import { DomainToBlockchainUtils } from '../../../shared/utils/domain-to-blockchain.utils';
import { CandidateDomainInterface } from '~/domain/account/interfaces/candidate-domain.interface';
import { Classes } from '@coopenomics/sdk';
import {
  AGREEMENT_CONFIGURATION_SERVICE,
  AgreementConfigurationService,
} from '~/domain/registration/services/agreement-configuration.service';
import { SOVIET_BLOCKCHAIN_PORT, type SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import type { AccountType } from '~/application/account/enum/account-type.enum';

@Injectable()
export class AccountBlockchainAdapter implements AccountBlockchainPort {
  private readonly logger = new Logger(AccountBlockchainAdapter.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
    @Inject(forwardRef(() => AGREEMENT_CONFIGURATION_SERVICE))
    private readonly agreementConfigService: AgreementConfigurationService,
    @Inject(VAULT_DOMAIN_SERVICE) private readonly vaultDomainService: VaultDomainService,
    @Inject(SOVIET_BLOCKCHAIN_PORT) private readonly sovietBlockchainPort: SovietBlockchainPort
  ) {}

  async registerBlockchainAccount(candidate: CandidateDomainInterface): Promise<void> {
    // Проверяем наличие заявления (обязательно для всех)
    if (!candidate.documents?.statement) {
      throw new HttpApiError(HttpStatus.BAD_REQUEST, 'Не найдено заявление на вступление');
    }

    // Получаем конфигурацию соглашений для типа аккаунта кандидата и выбранной программы
    const accountType = candidate.type as AccountType;
    const blockchainAgreements = this.agreementConfigService.getBlockchainAgreements(accountType, config.coopname, candidate.program_key);

    // Проверяем наличие всех требуемых документов на основе конфигурации
    for (const agreementConfig of blockchainAgreements) {
      const documentKey = agreementConfig.id as keyof typeof candidate.documents;
      if (!candidate.documents?.[documentKey]) {
        throw new HttpApiError(HttpStatus.BAD_REQUEST, `Не найден документ: ${agreementConfig.title}`);
      }
    }

    const wif = await this.vaultDomainService.getWif(config.coopname);
    if (!wif) throw new BadGatewayException('Не найден приватный ключ для совершения операции');

    await this.blockchainService.initialize(config.coopname, wif);

    const actions: any[] = [];

    // Повторная подача на том же аккаунте (после отказа совета и возврата взноса):
    // eosio-аккаунт уже существует — повторный CreateAccount упал бы. Создаём аккаунт
    // только если его ещё нет; карточку участника на цепи снял refundpay (type=""),
    // поэтому следующий RegisterUser проходит.
    const existingAccount = await this.getBlockchainAccount(candidate.username);
    if (!existingAccount) {
      // Создаем объект registerAccountData с данными из кандидата
      const registerAccountData: RegistratorContract.Actions.CreateAccount.ICreateAccount = {
        coopname: config.coopname,
        username: candidate.username,
        referer: candidate.referer || '',
        public_key: candidate.public_key,
        meta: candidate.meta || '{}',
      };

      actions.push({
        account: RegistratorContract.contractName.production,
        name: RegistratorContract.Actions.CreateAccount.actionName,
        authorization: [
          {
            actor: config.coopname,
            permission: 'active',
          },
        ],
        data: registerAccountData,
      });
    }

    // Создаем объект registerUserData с данными из кандидата
    const registerUserData: RegistratorContract.Actions.RegisterUser.IRegisterUser = {
      coopname: config.coopname,
      username: candidate.username,
      type: candidate.type,
      braname: candidate.braname || '',
      statement: Classes.Document.finalize(candidate.documents.statement),
      registration_hash: candidate.registration_hash,
    };

    actions.push({
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.RegisterUser.actionName,
      authorization: [
        {
          actor: config.coopname,
          permission: 'active',
        },
      ],
      data: registerUserData,
    });

    // Создаем completeDeposit
    const completeDeposit: GatewayContract.Actions.CompleteIncome.ICompleteIncome = {
      coopname: config.coopname,
      income_hash: candidate.registration_hash,
    };

    actions.push({
      account: GatewayContract.contractName.production,
      name: GatewayContract.Actions.CompleteIncome.actionName,
      authorization: [
        {
          actor: config.coopname,
          permission: 'active',
        },
      ],
      data: completeDeposit,
    });

    // Эпик 2 (компонент 48): программные соглашения (program_id > 0) пишет
    // wallet::signagree в `wallet::users.programs[]`; soviet::sndagreement
    // оставлен только для непрограммных типов и активно их отвергает.
    // Один lookup `coagreements` на bundle — даёт ровно один источник истины.
    const coagreements = await this.sovietBlockchainPort.getCoagreements(config.coopname);
    const coagreementByType = new Map<string, SovietContract.Tables.CoopAgreements.ICoopAgreement>();
    for (const ca of coagreements) coagreementByType.set(ca.type, ca);

    for (const agreementConfig of blockchainAgreements) {
      const documentKey = agreementConfig.id as keyof typeof candidate.documents;
      const document = candidate.documents?.[documentKey] as ISignedDocumentDomainInterface | undefined;
      if (!document) continue;

      const coagreement = coagreementByType.get(agreementConfig.agreement_type);
      const programId = coagreement ? Number(coagreement.program_id) : 0;

      if (programId > 0) {
        const draftId = Number(coagreement!.draft_id);
        this.logger.log(
          `register: wallet::signagree (${candidate.username} type=${agreementConfig.agreement_type} program_id=${programId} draft_id=${draftId})`
        );
        actions.push(this.createSignAgreementAction(candidate.username, programId, draftId, document));
      } else {
        actions.push(this.createSendAgreementAction(candidate.username, agreementConfig.agreement_type, document));
      }
    }

    await this.blockchainService.transact(actions);
  }

  /**
   * soviet::sndagreement — для непрограммных соглашений (program_id == 0).
   */
  private createSendAgreementAction(username: string, agreementType: string, document: ISignedDocumentDomainInterface): any {
    const agreementData: SovietContract.Actions.Agreements.SendAgreement.ISendAgreement = {
      coopname: config.coopname,
      administrator: config.coopname,
      username,
      agreement_type: agreementType,
      document: Classes.Document.finalize(document),
    };

    return {
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Agreements.SendAgreement.actionName,
      authorization: [
        {
          actor: config.coopname,
          permission: 'active',
        },
      ],
      data: agreementData,
    };
  }

  /**
   * wallet::signagree — для программных соглашений (program_id > 0).
   * Контракт требует существующего пайщика; в bundle регистрации это
   * гарантировано предыдущим registeruser action в той же транзакции.
   */
  private createSignAgreementAction(
    username: string,
    programId: number,
    draftId: number,
    document: ISignedDocumentDomainInterface
  ): any {
    const data: WalletContract.Actions.SignAgreement.ISignAgreement = {
      coopname: config.coopname,
      username,
      program_id: programId,
      draft_id: draftId,
      document: Classes.Document.finalize(document),
    };

    return {
      account: WalletContract.contractName.production,
      name: WalletContract.Actions.SignAgreement.actionName,
      authorization: [
        {
          actor: config.coopname,
          permission: 'active',
        },
      ],
      data,
    };
  }

  async exitCoop(data: import('~/domain/account/interfaces/account-blockchain.port').ExitCoopDomainInterface): Promise<void> {
    const wif = await this.vaultDomainService.getWif(data.coopname);
    if (!wif) throw new BadGatewayException('Не найден приватный ключ для совершения операции');

    await this.blockchainService.initialize(data.coopname, wif);

    const exitData: RegistratorContract.Actions.ExitCoop.IExitCoop = {
      coopname: data.coopname,
      username: data.username,
      exit_hash: data.exit_hash,
      statement: Classes.Document.finalize(data.statement),
    };

    await this.blockchainService.transact({
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.ExitCoop.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data: exitData,
    });
  }

  async addParticipantAccount(data: RegistratorContract.Actions.AddUser.IAddUser): Promise<void> {
    const wif = await this.vaultDomainService.getWif(data.coopname);

    if (!wif) throw new BadGatewayException('Не найден приватный ключ для совершения операции');

    await this.blockchainService.initialize(data.coopname, wif);

    await this.blockchainService.transact({
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.AddUser.actionName,
      authorization: [{ actor: data.coopname, permission: 'active' }],
      data,
    });
  }

  getBlockchainAccount(username: string): Promise<BlockchainAccountInterface | null> {
    return this.blockchainService.getAccount(username);
  }

  getExit(
    coopname: string,
    username: string
  ): Promise<RegistratorContract.Tables.Exits.IExit | null> {
    return this.blockchainService.getSingleRow(
      RegistratorContract.contractName.production,
      coopname,
      RegistratorContract.Tables.Exits.tableName,
      Name.from(username)
    );
  }

  async getExitByHash(
    coopname: string,
    exit_hash: string
  ): Promise<RegistratorContract.Tables.Exits.IExit | null> {
    // Таблица exits в scope=coopname мала (одна запись на выходящего пайщика,
    // удаляется при завершении), поэтому проще выбрать все строки и найти по
    // exit_hash, чем ходить во вторичный индекс byhash.
    const rows = await this.blockchainService.getAllRows<RegistratorContract.Tables.Exits.IExit>(
      RegistratorContract.contractName.production,
      coopname,
      RegistratorContract.Tables.Exits.tableName
    );
    const target = exit_hash.toLowerCase();
    return rows.find((r) => String(r.exit_hash).toLowerCase() === target) ?? null;
  }

  getParticipantAccount(
    coopname: string,
    username: string
  ): Promise<SovietContract.Tables.Participants.IParticipants | null> {
    return this.blockchainService.getSingleRow(
      SovietContract.contractName.production,
      coopname,
      SovietContract.Tables.Participants.tableName,
      Name.from(username)
    );
  }

  getUserAccount(username: string): Promise<RegistratorContract.Tables.Accounts.IAccount | null> {
    return this.blockchainService.getSingleRow(
      RegistratorContract.contractName.production,
      RegistratorContract.contractName.production,
      RegistratorContract.Tables.Accounts.tableName,
      Name.from(username)
    );
  }

  getCooperatorAccount(coopname: string): Promise<RegistratorContract.Tables.Cooperatives.ICooperative | null> {
    return this.blockchainService.getSingleRow(
      RegistratorContract.contractName.production,
      RegistratorContract.contractName.production,
      RegistratorContract.Tables.Cooperatives.tableName,
      Name.from(coopname)
    );
  }
}
