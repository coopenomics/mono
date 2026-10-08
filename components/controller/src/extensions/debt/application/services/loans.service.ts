import { Inject, Injectable } from '@nestjs/common';
import { Debt } from 'cooptypes';
import {
  CHAIN_PORT,
  DOCUMENT_PORT,
  type IChainPort,
  type IDocumentPort,
  type InnerDocumentAggregate,
} from '@coopenomics/innercoop';
import { DomainError, type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import httpStatus from 'http-status';
import { LOAN_REPOSITORY, type LoanListFilter, type LoanRepository } from '../../domain/repositories/loan.repository';
import type { LoanDomainEntity } from '../../domain/entities/loan.entity';
import { LoanOutputDTO, type LoanDocumentAggregates } from '../dto/loan.output';
import { CollateralOptionDTO } from '../dto/collateral-option.output';

/** Строка `ledger2::userwallets` — остаток пайщика по кошельку. */
interface UserWalletRow {
  username: string;
  wallet_name: string;
  available: string;
}

/**
 * Чтение займов и обеспечения. Реестр обеспечения — из cooptypes (копия
 * реестра контракта), остатки — из книги учёта, подписанное основание —
 * у программы-владельца.
 */
@Injectable()
export class LoansService {
  constructor(
    @Inject(LOAN_REPOSITORY) private readonly loans: LoanRepository,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort
  ) {}

  async getByHash(debtHash: string): Promise<LoanDomainEntity> {
    const loan = await this.loans.findByDebtHash(debtHash);
    if (!loan) throw new DomainError('DEBT_LOAN_NOT_FOUND', { debtHash }, httpStatus.NOT_FOUND);
    return loan;
  }

  async getByHashOutput(debtHash: string): Promise<LoanOutputDTO> {
    return this.toOutput(await this.getByHash(debtHash));
  }

  async listPaginated(filter: LoanListFilter, options?: PaginationInputDTO): Promise<PaginationResult<LoanOutputDTO>> {
    const { items, totalCount } = await this.loans.findPaginated(filter, options);
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, options?.limit ?? 10);
    return {
      items: await Promise.all(items.map((loan) => this.toOutput(loan))),
      totalCount,
      totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 0,
      currentPage: page,
    };
  }

  /** Виды обеспечения из реестра с остатком пайщика и признаком подписанного основания. */
  async collateralOptions(coopname: string, username: string): Promise<CollateralOptionDTO[]> {
    const wallets = (await this.chain.getAllRows<UserWalletRow>('ledger2', coopname, 'userwallets')).filter(
      (w) => w.username === username
    );
    const options: CollateralOptionDTO[] = [];
    for (const entry of Debt.DEBT_COLLATERAL_REGISTRY) {
      const wallet = wallets.find((w) => w.wallet_name === entry.source_wallet);
      const dto = new CollateralOptionDTO();
      dto.key = entry.key;
      dto.human_name = entry.human_name;
      dto.source_wallet = entry.source_wallet;
      dto.pledge_wallet = entry.pledge_wallet;
      dto.available = wallet?.available ?? '';
      dto.basis_type = entry.basis_type;
      dto.basis_signed = await this.isBasisSigned(coopname, username, entry);
      dto.owner_contract = entry.owner_contract;
      options.push(dto);
    }
    return options;
  }

  /**
   * Основание подписано: у программы «Благорост» — договор об участии
   * (запись участника в контракте capital с документом договора либо внешний
   * договор). Для других программ реестр пока не содержит записей.
   */
  private async isBasisSigned(coopname: string, username: string, entry: Debt.CollateralMeta): Promise<boolean> {
    if (entry.owner_contract !== 'capital') return false;
    const contributor = await this.chain.getSingleRow<{ is_external_contract: boolean; contract?: { hash?: string } }>(
      'capital',
      coopname,
      'contributors',
      username,
      '2',
      'name'
    );
    if (!contributor) return false;
    const hash = contributor.contract?.hash ?? '';
    return Boolean(contributor.is_external_contract) || (hash !== '' && !/^0+$/.test(hash));
  }

  async toOutput(loan: LoanDomainEntity): Promise<LoanOutputDTO> {
    const aggregate = (doc?: LoanDomainEntity['statement']): Promise<InnerDocumentAggregate | null | undefined> =>
      doc ? this.documents.buildAggregate(doc) : Promise.resolve(undefined);
    const [statement, contract, signed_contract, decision, extension_statement] = await Promise.all([
      aggregate(loan.statement),
      aggregate(loan.contract),
      aggregate(loan.signed_contract),
      aggregate(loan.decision),
      aggregate(loan.extension_statement),
    ]);
    const aggregates: LoanDocumentAggregates = { statement, contract, signed_contract, decision, extension_statement };
    return LoanOutputDTO.fromDomain(loan, aggregates);
  }
}
