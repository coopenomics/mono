import { Inject, Injectable } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import {
  LOGGER_PORT,
  USER_WALLET_PORT,
  type ILoggerPort,
  type ISignedDocument,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import { platformSettings, DomainError } from '@coopenomics/extension-kit';
import { EduReturnStatus } from '../../domain/enums';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeReturnRequestEntity } from '../../infrastructure/entities';
import { EdubridgeReturnRequestRepository } from '../../infrastructure/repositories/edubridge-return-request.repository';
import { EdubridgeEnrollmentService } from './edubridge-enrollment.service';

/** Кошелёк членских взносов программы — его остаток уходит в паевой. */
const MEMBER_WALLET = 'w.edu.member';
/** Программа «Обучение» ЦПП «Образование» в реестре программ кооператива. */
const EDU_LEARNER_PROGRAM_ID = 5;

export interface ReturnBalance {
  /** Остаток кошелька программы. */
  available: string;
  /** Сколько вернут по действующим подпискам, если закрыть их сегодня. */
  refunds: string;
  /** Сколько уйдёт в паевой при прекращении участия сегодня. */
  total: string;
  /** Действующих подписок, которые закроются. */
  subscriptions: number;
  /** Заявление о прекращении участия уже подано и ждёт согласования. */
  has_pending: boolean;
}

/**
 * Прекращение участия в ЦПП «Образование». Членский взнос программы
 * возвращается в паевой только с прекращением участия: по заявлению пайщика,
 * при выходе из кооператива, при отмене курса по недобору. Пока пайщик
 * участвует в программе, остаток кошелька программы идёт на новые подписки.
 *
 * Путь двухшаговый (п. 4.2.5 Положения требует согласования Обществом):
 * пайщик подписывает заявление об аннулировании соглашения (190) — тот же
 * бланк, что при выходе из кооператива, только без выхода и с одной программой
 * в таблице, — кооператив согласует. Тогда подписки закрываются с возвратом по
 * Положению, и `retshare` переводит весь остаток в паевой (Дт 86 / Кт 80) и
 * аннулирует соглашение о программе.
 */
@Injectable()
export class EdubridgeReturnService {
  constructor(
    private readonly requests: EdubridgeReturnRequestRepository,
    private readonly enrollments: EdubridgeEnrollmentService,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(USER_WALLET_PORT) private readonly wallets: IUserWalletPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeReturnService.name);
  }

  listMine(coopname: string, member: string): Promise<EdubridgeReturnRequestEntity[]> {
    return this.requests.findByMember(coopname, member);
  }

  listAll(coopname: string, status?: EduReturnStatus): Promise<EdubridgeReturnRequestEntity[]> {
    return this.requests.findByStatus(coopname, status);
  }

  /** Что уйдёт в паевой, если прекратить участие сегодня. */
  async balance(coopname: string, member: string): Promise<ReturnBalance> {
    const symbol = platformSettings().blockchain.rootGovernSymbol;
    const asset = (value: number): string => `${Math.max(0, value).toFixed(4)} ${symbol}`;
    const available = await this.walletAvailable(coopname, member);
    const { subscriptions, refunds } = await this.enrollments.refundsOnExit(coopname, member);
    return {
      available: asset(available),
      refunds: asset(refunds),
      total: asset(available + refunds),
      subscriptions,
      has_pending: await this.hasPending(coopname, member),
    };
  }

  /** Пайщик подал подписанное заявление — оно ждёт согласования кооперативом. */
  async request(coopname: string, member: string, document: ISignedDocument): Promise<EdubridgeReturnRequestEntity> {
    if (!document.signatures?.some((s) => s.signer === member)) throw DomainError.badRequest('EDUBRIDGE_RETURN_STATEMENT_NOT_SIGNED');
    assertProgramAnnulment(metaOf(document));
    await this.assertNoPending(coopname, member);

    const saved = await this.requests.save(
      this.requests.create({
        coopname,
        member_username: member,
        // Точная сумма известна в день согласования; до него — оценка на день подачи.
        amount: (await this.balance(coopname, member)).total,
        statement_hash: document.hash.toLowerCase(),
        statement_document: document as unknown as Record<string, unknown>,
        status: EduReturnStatus.PENDING,
      })
    );
    this.logger.info(`[EDU.EXIT] ${member}: заявление о прекращении участия в программе ждёт согласования`);
    return saved;
  }

  /**
   * Кооператив согласовал: подписки закрываются с возвратом по Положению, весь
   * остаток кошелька программы уходит в паевой, соглашение о программе аннулируется.
   */
  async approve(coopname: string, id: string, actor: string): Promise<EdubridgeReturnRequestEntity> {
    const r = await this.pending(coopname, id);
    const member = r.member_username;
    const symbol = platformSettings().blockchain.rootGovernSymbol;

    // Остаток до закрытия подписок: возвраты по ним лягут сверху, книга ещё не успела их отразить.
    const before = await this.walletAvailable(coopname, member);
    // i18n-ignore: текст журнала (причина уходит только в logger), до пайщика не доходит
    const cancelled = await this.enrollments.cancelAllForMember(coopname, member, 'прекращение участия в программе');
    const left = await this.enrollments.refundsOnExit(coopname, member);
    if (left.subscriptions > 0) {
      throw DomainError.badRequest('EDUBRIDGE_RETURN_CLOSE_PARTIAL', { left: left.subscriptions });
    }
    const refunds = cancelled.reduce((sum, e) => sum + (Number.parseFloat(e.refunded_amount ?? '0') || 0), 0);
    const amount = `${(before + refunds).toFixed(4)} ${symbol}`;

    await this.chain.returnToShare({ coopname, username: member, amount, statement: r.statement_document } as never);

    r.amount = amount;
    r.status = EduReturnStatus.APPROVED;
    r.decided_by = actor;
    r.decided_at = new Date();
    const saved = await this.requests.save(r);
    this.logger.info(`[EDU.EXIT] ${member}: участие в программе прекращено, ${amount} в паевой взнос, согласовал ${actor}`);
    return saved;
  }

  /** Кооператив отклонил заявление — участие продолжается, остаток на кошельке программы. */
  async decline(coopname: string, id: string, actor: string, reason: string): Promise<EdubridgeReturnRequestEntity> {
    if (!reason?.trim()) throw DomainError.badRequest('EDUBRIDGE_RETURN_DECLINE_REASON_REQUIRED');
    const r = await this.pending(coopname, id);
    r.status = EduReturnStatus.DECLINED;
    r.decline_reason = reason.trim();
    r.decided_by = actor;
    r.decided_at = new Date();
    return this.requests.save(r);
  }

  private async pending(coopname: string, id: string): Promise<EdubridgeReturnRequestEntity> {
    const r = await this.requests.findById(coopname, id);
    if (!r) throw DomainError.notFound('EDUBRIDGE_RETURN_REQUEST_NOT_FOUND');
    if (r.status !== EduReturnStatus.PENDING) throw DomainError.badRequest('EDUBRIDGE_RETURN_REQUEST_ALREADY_DECIDED');
    return r;
  }

  private async hasPending(coopname: string, member: string): Promise<boolean> {
    return (await this.requests.findByMember(coopname, member)).some((r) => r.status === EduReturnStatus.PENDING);
  }

  private async assertNoPending(coopname: string, member: string): Promise<void> {
    if (await this.hasPending(coopname, member)) {
      throw DomainError.badRequest('EDUBRIDGE_RETURN_REQUEST_ALREADY_PENDING');
    }
  }

  private async walletAvailable(coopname: string, member: string): Promise<number> {
    const wallet = await this.wallets.findByWalletAndUsername(coopname, MEMBER_WALLET, member);
    return toNumber(wallet?.available);
  }
}

function toNumber(asset: string | null | undefined): number {
  return Number.parseFloat(String(asset ?? '0')) || 0;
}

/**
 * Подписано заявление об аннулировании соглашения (190) именно об этой
 * программе и без выхода из кооператива: выход ведёт ядро своим порядком.
 */
function assertProgramAnnulment(meta: Record<string, unknown>): void {
  if (Number(meta.registry_id) !== Cooperative.Registry.ProgramAgreementsAnnulmentStatement.registry_id) {
    throw DomainError.badRequest('EDUBRIDGE_RETURN_WRONG_DOCUMENT');
  }
  if (meta.exit_hash) {
    throw DomainError.badRequest('EDUBRIDGE_RETURN_SIGNED_WITH_EXIT');
  }
  const programs = Array.isArray(meta.programs) ? (meta.programs as Array<{ program_id?: unknown }>) : [];
  if (programs.length !== 1 || Number(programs[0]?.program_id) !== EDU_LEARNER_PROGRAM_ID) {
    throw DomainError.badRequest('EDUBRIDGE_RETURN_SINGLE_PROGRAM_REQUIRED');
  }
}

/** Мета подписанного документа приходит объектом либо строкой JSON. */
function metaOf(document: ISignedDocument): Record<string, unknown> {
  const raw = document.meta as unknown;
  if (typeof raw !== 'string') return (raw ?? {}) as Record<string, unknown>;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
