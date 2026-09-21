import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import {
  DOCUMENT_PORT,
  LOGGER_PORT,
  USER_WALLET_PORT,
  type IDocumentPort,
  type ILoggerPort,
  type InnerGeneratedDocument,
  type ISignedDocument,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { EduReturnStatus } from '../../domain/enums';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import type { EdubridgeReturnRequestEntity } from '../../infrastructure/entities';
import { EdubridgeReturnRequestRepository } from '../../infrastructure/repositories/edubridge-return-request.repository';

/** Кошелёк членских взносов программы — источник возврата. */
const MEMBER_WALLET = 'w.edu.member';
const ASSET_PATTERN = /^(\d+\.\d{4}) ([A-Z]{1,7})$/;

export interface ReturnBalance {
  /** Остаток кошелька программы. */
  available: string;
  /** Сколько уже заявлено к возврату и ждёт согласования. */
  pending: string;
  /** Сколько ещё можно заявить. */
  free: string;
}

/**
 * Возврат остатка кошелька программы в паевой взнос. Положение ЦПП
 * «Образование» (пп. 4.2.4, 4.2.5) отдаёт возвращённые участнику взносы в его
 * распоряжение: на другую подписку либо обратно в Цифровой Кошелёк — по
 * заявлению Участника и согласованию Общества. Поэтому путь двухшаговый:
 * пайщик подписывает заявление 3013, кооператив согласует, и только тогда
 * `retshare` переводит средства (Дт 86 / Кт 80).
 */
@Injectable()
export class EdubridgeReturnService {
  constructor(
    private readonly requests: EdubridgeReturnRequestRepository,
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(DOCUMENT_PORT) private readonly documents: IDocumentPort,
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

  /** Сколько на кошельке программы и сколько из этого ещё не заявлено к возврату. */
  async balance(coopname: string, member: string): Promise<ReturnBalance> {
    const symbol = platformSettings().blockchain.rootGovernSymbol;
    const wallet = await this.wallets.findByWalletAndUsername(coopname, MEMBER_WALLET, member);
    const available = toNumber(wallet?.available);
    const pending = (await this.requests.findByMember(coopname, member))
      .filter((r) => r.status === EduReturnStatus.PENDING)
      .reduce((sum, r) => sum + toNumber(r.amount), 0);
    const asset = (value: number): string => `${Math.max(0, value).toFixed(4)} ${symbol}`;
    return { available: asset(available), pending: asset(pending), free: asset(available - pending) };
  }

  /** Заявление 3013 без подписи — пайщик подписывает его на фронте. */
  async statement(coopname: string, member: string, amount: string): Promise<InnerGeneratedDocument> {
    await this.assertAmount(coopname, member, amount);
    const action: Cooperative.Registry.EducationReturnStatement.Action = {
      registry_id: Cooperative.Registry.EducationReturnStatement.registry_id,
      coopname,
      username: member,
      lang: 'ru',
      amount,
      skip_save: false,
    };
    return this.documents.generate({ data: action });
  }

  /** Пайщик подал подписанное заявление — заявка ждёт согласования кооперативом. */
  async request(coopname: string, member: string, amount: string, document: ISignedDocument): Promise<EdubridgeReturnRequestEntity> {
    if (!document.signatures?.some((s) => s.signer === member)) throw new BadRequestException('Заявление не подписано пайщиком');
    if (String(metaOf(document).amount ?? '') !== amount) {
      throw new BadRequestException('Сумма заявки расходится с суммой в подписанном заявлении');
    }
    await this.assertAmount(coopname, member, amount);

    const saved = await this.requests.save(
      this.requests.create({
        coopname,
        member_username: member,
        amount,
        statement_hash: document.hash.toLowerCase(),
        statement_document: document as unknown as Record<string, unknown>,
        status: EduReturnStatus.PENDING,
      })
    );
    this.logger.info(`[EDU.RETURN] ${member}: заявка на возврат ${amount} в паевой взнос ждёт согласования`);
    return saved;
  }

  /** Кооператив согласовал заявление: `retshare` переводит остаток в паевой взнос. */
  async approve(coopname: string, id: string, actor: string): Promise<EdubridgeReturnRequestEntity> {
    const r = await this.pending(coopname, id);
    const wallet = await this.wallets.findByWalletAndUsername(coopname, MEMBER_WALLET, r.member_username);
    if (toNumber(wallet?.available) < toNumber(r.amount)) {
      throw new BadRequestException(
        `На кошельке программы пайщика ${wallet?.available ?? '0'} — меньше заявленного ${r.amount}: средства потрачены на подписку. Отклоните заявку, пайщик подаст новую`
      );
    }

    await this.chain.returnToShare({
      coopname,
      username: r.member_username,
      amount: r.amount,
      statement: r.statement_document,
    } as never);

    r.status = EduReturnStatus.APPROVED;
    r.decided_by = actor;
    r.decided_at = new Date();
    const saved = await this.requests.save(r);
    this.logger.info(`[EDU.RETURN] ${r.member_username}: ${r.amount} возвращены в паевой взнос, согласовал ${actor}`);
    return saved;
  }

  /** Кооператив отклонил заявление — остаток остаётся на кошельке программы. */
  async decline(coopname: string, id: string, actor: string, reason: string): Promise<EdubridgeReturnRequestEntity> {
    if (!reason?.trim()) throw new BadRequestException('Укажите причину отказа');
    const r = await this.pending(coopname, id);
    r.status = EduReturnStatus.DECLINED;
    r.decline_reason = reason.trim();
    r.decided_by = actor;
    r.decided_at = new Date();
    return this.requests.save(r);
  }

  private async pending(coopname: string, id: string): Promise<EdubridgeReturnRequestEntity> {
    const r = await this.requests.findById(coopname, id);
    if (!r) throw new NotFoundException('Заявка не найдена');
    if (r.status !== EduReturnStatus.PENDING) throw new BadRequestException('По заявке уже принято решение');
    return r;
  }

  /** Сумма — в формате цепи, больше нуля и не больше незаявленного остатка. */
  private async assertAmount(coopname: string, member: string, amount: string): Promise<void> {
    if (!ASSET_PATTERN.test(amount) || !(toNumber(amount) > 0)) {
      throw new BadRequestException('Сумма возврата указывается в формате «1000.0000 RUB» и больше нуля');
    }
    const balance = await this.balance(coopname, member);
    if (toNumber(amount) > toNumber(balance.free)) {
      throw new BadRequestException(`К возврату доступно ${balance.free}: остаток кошелька программы за вычетом уже поданных заявок`);
    }
  }
}

function toNumber(asset: string | null | undefined): number {
  return Number.parseFloat(String(asset ?? '0')) || 0;
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
