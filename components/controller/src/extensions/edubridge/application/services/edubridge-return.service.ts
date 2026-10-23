import { Inject, Injectable } from '@nestjs/common';
import { USER_WALLET_PORT, type IUserWalletPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { EdubridgeEnrollmentService } from './edubridge-enrollment.service';

/** Кошелёк членских взносов программы — его остаток уходит в паевой. */
const MEMBER_WALLET = 'w.edu.member';

export interface ReturnBalance {
  /** Остаток кошелька программы. */
  available: string;
  /** Сколько вернут по действующим подпискам, если закрыть их сегодня. */
  refunds: string;
  /** Сколько уйдёт в паевой при выходе из кооператива сегодня. */
  total: string;
  /** Действующих подписок, которые закроются. */
  subscriptions: number;
}

/**
 * Кошелёк программы «Образование». Отдельного выхода из программы нет: пока
 * пайщик в кооперативе, остаток кошелька идёт на новые подписки, а в паевой
 * взнос он возвращается только при выходе из кооператива — этот возврат ведёт
 * ядро по политике кошельков. Расширению остаётся показать пайщику остаток.
 */
@Injectable()
export class EdubridgeReturnService {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentService,
    @Inject(USER_WALLET_PORT) private readonly wallets: IUserWalletPort
  ) {}

  /** Что уйдёт в паевой, если выйти из кооператива сегодня. */
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
    };
  }

  private async walletAvailable(coopname: string, member: string): Promise<number> {
    const wallet = await this.wallets.findByWalletAndUsername(coopname, MEMBER_WALLET, member);
    return toNumber(wallet?.available);
  }
}

function toNumber(asset: string | null | undefined): number {
  return Number.parseFloat(String(asset ?? '0')) || 0;
}
