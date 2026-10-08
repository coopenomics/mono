import { Inject, Injectable } from '@nestjs/common';
import { Cooperative, Debt } from 'cooptypes';
import httpStatus from 'http-status';
import {
  DomainError,
  SignedDigitalDocumentInputDTO,
  type GenerateDocumentOptionsInputDTO,
} from '@coopenomics/extension-kit';
import {
  DOCUMENT_PORT,
  type IDocumentPort,
  type IMonoAccount,
  type InnerGeneratedDocument,
  type InnerTransactResult,
} from '@coopenomics/innercoop';
import { DEBT_BLOCKCHAIN_PORT, type DebtBlockchainPort } from '../../domain/interfaces/debt-blockchain.port';
import { LoanStatus } from '../../domain/enums/loan-status.enum';
import { LoansService } from './loans.service';
import type { CreateLoanInputDTO } from '../dto/create-loan.input';
import type { CancelLoanInputDTO, ExtendLoanInputDTO, LoanRefInputDTO, RepayLoanInputDTO } from '../dto/loan-action.inputs';
import type {
  GenerateExtensionStatementInputDTO,
  GenerateLoanContractInputDTO,
  GenerateLoanDecisionInputDTO,
  GenerateLoanStatementInputDTO,
  GenerateRepaymentStatementInputDTO,
} from '../documents-dto/loan-documents.dto';

/** Документ с подписью пайщика в форме действия цепи. */
function toChainDocument(input: SignedDigitalDocumentInputDTO) {
  const doc = new SignedDigitalDocumentInputDTO(input).toDocument();
  return {
    version: doc.version,
    hash: doc.hash,
    doc_hash: doc.doc_hash,
    meta_hash: doc.meta_hash,
    meta: doc.meta,
    signatures: doc.signatures,
  } as any;
}

/**
 * Запись в цепь по займам: подача заявления с договором, отмена, повтор
 * платежа, возврат и продление. Решение совета, подпись председателя и
 * выплата приходят обратными вызовами контрактов.
 */
@Injectable()
export class LoanMutationsService {
  constructor(
    @Inject(DEBT_BLOCKCHAIN_PORT) private readonly chain: DebtBlockchainPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
    private readonly loans: LoansService
  ) {}

  private collateralOrFail(key: string): Debt.CollateralMeta {
    const entry = Debt.findCollateral(key);
    if (!entry) throw new DomainError('DEBT_COLLATERAL_UNKNOWN', { key }, httpStatus.BAD_REQUEST);
    return entry;
  }

  /** Данные основания для фабрики: тип по реестру обеспечения; программа — у «Благороста». */
  private basisOf(entry: Debt.CollateralMeta) {
    return { basis_type: entry.basis_type === 'OFFER' ? 'offer' : 'uhd', program_name: 'Благорост' };
  }

  // ── Документы ──────────────────────────────────────────────────────────

  async generateStatement(data: GenerateLoanStatementInputDTO, options?: GenerateDocumentOptionsInputDTO): Promise<InnerGeneratedDocument> {
    const entry = this.collateralOrFail(data.collateral);
    return this.documents.generate({
      data: { ...data, ...this.basisOf(entry), registry_id: Cooperative.Registry.GetLoanStatement.registry_id },
      options,
    });
  }

  async generateContract(data: GenerateLoanContractInputDTO, options?: GenerateDocumentOptionsInputDTO): Promise<InnerGeneratedDocument> {
    const entry = this.collateralOrFail(data.collateral);
    return this.documents.generate({
      data: { ...data, ...this.basisOf(entry), registry_id: Cooperative.Registry.LoanContractShare.registry_id },
      options,
    });
  }

  async generateDecision(data: GenerateLoanDecisionInputDTO, options?: GenerateDocumentOptionsInputDTO): Promise<InnerGeneratedDocument> {
    const entry = this.collateralOrFail(data.collateral);
    return this.documents.generate({
      data: { ...data, ...this.basisOf(entry), registry_id: Cooperative.Registry.GetLoanDecision.registry_id },
      options,
    });
  }

  async generateRepaymentStatement(
    data: GenerateRepaymentStatementInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    const loan = await this.loans.getByHash(data.debt_hash);
    return this.documents.generate({
      data: {
        ...data,
        contract_date: loan.created_at ?? '',
        registry_id: Cooperative.Registry.LoanRepaymentStatement.registry_id,
      },
      options,
    });
  }

  async generateExtensionStatement(
    data: GenerateExtensionStatementInputDTO,
    options?: GenerateDocumentOptionsInputDTO
  ): Promise<InnerGeneratedDocument> {
    const loan = await this.loans.getByHash(data.debt_hash);
    return this.documents.generate({
      data: {
        ...data,
        remaining: data.remaining ?? loan.remaining ?? loan.amount ?? '',
        contract_date: loan.created_at ?? '',
        registry_id: Cooperative.Registry.LoanExtensionStatement.registry_id,
      },
      options,
    });
  }

  // ── Действия цепи ──────────────────────────────────────────────────────

  async createLoan(input: CreateLoanInputDTO): Promise<InnerTransactResult> {
    this.collateralOrFail(input.collateral);
    return this.chain.createLoan({
      coopname: input.coopname,
      username: input.username,
      collateral: input.collateral,
      debt_hash: input.debt_hash,
      amount: input.amount,
      due_at: input.due_at,
      statement: toChainDocument(input.statement),
      contract: toChainDocument(input.contract),
    });
  }

  async retryPay(input: LoanRefInputDTO): Promise<InnerTransactResult> {
    const loan = await this.loans.getByHash(input.debt_hash);
    if (loan.status !== LoanStatus.SIGNED) {
      throw new DomainError('DEBT_RETRY_NOT_ALLOWED', { debtHash: input.debt_hash }, httpStatus.CONFLICT);
    }
    return this.chain.retryPay({ coopname: input.coopname, debt_hash: input.debt_hash });
  }

  /** Отмена до выплаты: свой заём отменяет пайщик, любой — председатель. */
  async cancelLoan(input: CancelLoanInputDTO, user: IMonoAccount): Promise<InnerTransactResult> {
    const loan = await this.loans.getByHash(input.debt_hash);
    this.assertOwnOrChairman(loan.username, user);
    if (!loan.isOwn) throw new DomainError('DEBT_LOAN_FOREIGN', { debtHash: input.debt_hash }, httpStatus.CONFLICT);
    return this.chain.cancelLoan({ coopname: input.coopname, debt_hash: input.debt_hash, reason: input.reason ?? '' });
  }

  async repayLoan(input: RepayLoanInputDTO, user: IMonoAccount): Promise<InnerTransactResult> {
    const loan = await this.loans.getByHash(input.debt_hash);
    this.assertOwnOrChairman(loan.username, user);
    return this.chain.repayLoan({
      coopname: input.coopname,
      username: input.username,
      debt_hash: input.debt_hash,
      amount: input.amount,
      statement: toChainDocument(input.statement),
    });
  }

  async extendLoan(input: ExtendLoanInputDTO, user: IMonoAccount): Promise<InnerTransactResult> {
    const loan = await this.loans.getByHash(input.debt_hash);
    this.assertOwnOrChairman(loan.username, user);
    return this.chain.extendLoan({
      coopname: input.coopname,
      username: input.username,
      debt_hash: input.debt_hash,
      new_due_at: input.new_due_at,
      statement: toChainDocument(input.statement),
    });
  }

  /**
   * Контракт проверяет только подпись кооператива, а транзакцию шлёт
   * кооператив — личность пайщика сверяется здесь: своим займом
   * распоряжается пайщик, любым — председатель.
   */
  private assertOwnOrChairman(owner: string | undefined, user: IMonoAccount): void {
    if (user.role === 'chairman') return;
    if (owner !== user.username) {
      throw new DomainError('DEBT_LOAN_NOT_OWN', { owner: owner ?? '' }, httpStatus.FORBIDDEN);
    }
  }
}
