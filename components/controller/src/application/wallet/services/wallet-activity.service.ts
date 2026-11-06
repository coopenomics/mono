import { Inject, Injectable } from '@nestjs/common';
import { Ledger2 } from 'cooptypes';
import type { PaginationResult } from '@coopenomics/extension-kit';
import { Ledger2Service } from '~/application/ledger2/services/ledger2.service';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import {
  PAYOUT_REQUEST_REPOSITORY,
  type PayoutRequestRepository,
} from '~/domain/gateway/repositories/payout-request.repository';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PAYMENT_TYPE_LABELS, PaymentDirectionEnum, PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import { t } from '~/i18n';
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import {
  WalletMovementDirection,
  WalletPendingState,
  type GetMyPendingPayoutsInputDTO,
  type GetMyWalletMovementsInputDTO,
  type WalletMovementDTO,
  type WalletPendingItemDTO,
} from '../dto/wallet-activity.dto';

const USER_SHARED = 'USER_SHARED';
const DEFAULT_LIMIT = 20;
/** Сколько последних платежей пайщика смотреть в поиске неисполненных. */
const PENDING_SCAN_LIMIT = 50;

/**
 * Название строки «В работе» — назначение платежа, то же, что видит кассир
 * («Оплата по договору № …», «Паевой взнос по соглашению о ЦПП …»,
 * «Материальная помощь № …»; решение владельца 06.11.2026). Своих подписей
 * поверх назначения сервер не сочиняет. Назначения нет — вид платежа.
 */
const TYPE_TITLES: Partial<Record<string, string>> = {
  [PaymentTypeEnum.DEPOSIT]: 'wallet.walletActivity.pendingTitle.deposit',
  [PaymentTypeEnum.WITHDRAWAL]: 'wallet.walletActivity.pendingTitle.withdrawal',
  [PaymentTypeEnum.AID]: 'wallet.walletActivity.pendingTitle.aid',
};

function memberTitle(type: string, memo: string | null | undefined): string {
  const purpose = memo?.trim();
  if (purpose) return purpose;
  const key = TYPE_TITLES[type];
  return key ? t(key) : (PAYMENT_TYPE_LABELS[type as PaymentTypeEnum] ?? String(type));
}

/** Кошелёк пайщика — разрез по пайщику, а не общий баланс кооператива. */
function isMemberWallet(name: string | null | undefined): boolean {
  return !!name && Ledger2.getWalletKind(name) === USER_SHARED;
}

const orNull = <T>(value: T | null | undefined): T | null => value ?? null;

/** Название кошелька для строки истории; без кошелька — пусто. */
function walletTitle(wallet: string | null): string | null {
  return wallet ? (Ledger2.getWalletHumanName(wallet) ?? wallet) : null;
}

/** Операции учётной книги, которые трогают выбранный кошелёк: источник или приёмник. */
function walletOperationCodes(walletName: string): string[] {
  return Ledger2.LEDGER2_OPERATION_REGISTRY.filter((op) => op.wallet_from === walletName || op.wallet_to === walletName).map(
    (op) => op.code
  );
}

/**
 * История и неисполненные заявки пайщика для страницы кошелька (решение
 * владельца 04.11.2026): движения по всем кошелькам пайщика с отбором по
 * одному, а над ними — что ещё в работе: заявки на выплату до решения совета,
 * выплаты у кассира, неоплаченные пополнения.
 */
@Injectable()
export class WalletActivityService {
  constructor(
    private readonly ledger2: Ledger2Service,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(PAYOUT_REQUEST_REPOSITORY) private readonly payoutRequests: PayoutRequestRepository
  ) {}

  async movements(input: GetMyWalletMovementsInputDTO): Promise<PaginationResult<WalletMovementDTO>> {
    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_LIMIT;
    // Без отбора — все операции пайщика (выплата возврата из резерва
    // кооператива тоже его история); с отбором — операции этого кошелька.
    const codes = input.wallet_name ? walletOperationCodes(input.wallet_name) : undefined;
    if (codes && codes.length === 0) return { items: [], totalCount: 0, totalPages: 0, currentPage: page };

    const history = await this.ledger2.getHistory({
      coopname: input.coopname,
      username: input.username,
      actionNames: ['apply'],
      operationCodes: codes,
      page,
      limit,
      sortOrder: 'DESC',
    });
    return {
      items: history.items.map((op) => this.toMovement(op, input.wallet_name ?? undefined)),
      totalCount: history.totalCount,
      totalPages: history.totalPages,
      currentPage: history.currentPage,
    };
  }

  async pending(input: GetMyPendingPayoutsInputDTO): Promise<WalletPendingItemDTO[]> {
    const requests = await this.payoutRequests.listAwaitingByMember(input.coopname, input.username);
    const latest = await this.payments.getAllPayments(
      { coopname: input.coopname, username: input.username },
      { page: 1, limit: PENDING_SCAN_LIMIT, sortOrder: 'DESC' }
    );
    const open = latest.items.map((p) => this.pendingPayment(p)).filter((p): p is WalletPendingItemDTO => p !== null);
    const items: WalletPendingItemDTO[] = [
      ...requests.map((r) => ({
        hash: r.hash,
        type: r.type,
        title: memberTitle(r.type, r.memo),
        state: WalletPendingState.COUNCIL_REVIEW,
        quantity: `${r.quantity.toFixed(4)} ${r.symbol}`,
        payment_method_id: r.payment_method_id ?? null,
        created_at: r.created_at,
      })),
      ...open,
    ];
    return items.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  /** Платёж, который ещё не исполнен: выплата у кассира или пополнение без оплаты. */
  private pendingPayment(p: PaymentDomainInterface): WalletPendingItemDTO | null {
    const waiting = p.status === PaymentStatusEnum.PENDING || p.status === PaymentStatusEnum.PROCESSING;
    if (!waiting) return null;
    return {
      hash: p.hash,
      type: p.type,
      title: memberTitle(p.type, p.memo),
      state: p.direction === PaymentDirectionEnum.OUTGOING ? WalletPendingState.AWAITING_CASHIER : WalletPendingState.AWAITING_PAYMENT,
      quantity: `${Number(p.quantity).toFixed(4)} ${p.symbol}`,
      payment_method_id: p.payment_method_id ?? null,
      created_at: p.created_at,
    };
  }

  /** Строка движения: кошелёк пайщика и направление — по реестру операций. */
  private toMovement(
    op: { globalSequence: string; createdAt: Date; operationCode?: string | null; quantity?: string | null; processHash?: string | null; memo?: string | null },
    walletFilter?: string
  ): WalletMovementDTO {
    const code = op.operationCode ?? '';
    const meta = Ledger2.getOperationMeta(code);
    const fromMember = isMemberWallet(meta?.wallet_from);
    const toMember = isMemberWallet(meta?.wallet_to);
    const direction = this.directionOf(fromMember, toMember, meta?.wallet_from, meta?.wallet_to, walletFilter);
    const wallet = orNull(direction === WalletMovementDirection.IN ? meta?.wallet_to : meta?.wallet_from);
    return {
      global_sequence: op.globalSequence,
      created_at: op.createdAt,
      operation_code: code,
      operation_name: Ledger2.getOperationHumanName(code) ?? code,
      wallet_name: wallet,
      wallet_title: walletTitle(wallet),
      direction,
      quantity: op.quantity ?? '',
      process_hash: orNull(op.processHash),
      process_type: orNull(Ledger2.getOperationProcessType(code)),
      memo: orNull(op.memo),
    };
  }

  /**
   * Перевод между своими кошельками в отборе по одному из них — поступление
   * или списание относительно выбранного кошелька; без отбора — перевод.
   */
  private directionOf(
    fromMember: boolean,
    toMember: boolean,
    from: string | null | undefined,
    to: string | null | undefined,
    walletFilter?: string
  ): WalletMovementDirection {
    if (!fromMember && !toMember) return WalletMovementDirection.PROCESS;
    if (fromMember && toMember) {
      if (walletFilter && to === walletFilter) return WalletMovementDirection.IN;
      if (walletFilter && from === walletFilter) return WalletMovementDirection.OUT;
      return WalletMovementDirection.MOVE;
    }
    return toMember ? WalletMovementDirection.IN : WalletMovementDirection.OUT;
  }
}
