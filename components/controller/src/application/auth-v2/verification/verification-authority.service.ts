import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import { BRANCH_BLOCKCHAIN_PORT, type BranchBlockchainPort } from '~/domain/branch/interfaces/branch-blockchain.port';

/** Роль председателя совета — она даёт право распоряжаться верификациями. */
const CHAIRMAN_ROLE = 'chairman';

/** Кто просит провести верификацию: сам аккаунт, его роль и место сверки. */
export interface VerificationActor {
  username: string;
  role: string;
  /** Кооперативный участок, где идёт сверка; пусто — сверяет совет кооператива. */
  braname?: string;
}

/**
 * Кто вправе сверять личность пайщика.
 *
 * Указан участок — сверяет его председатель или доверенное лицо (тот же круг,
 * что проверяет контракт по таблице участка). Участка нет — сверяет председатель
 * совета кооператива. Проверка нужна на сервере, потому что транзакцию
 * подписывает кооператив, и контракт в этом случае доверяет ему; тем же ответом
 * закрывается и выдача персональных данных для сверки.
 *
 * Штатный `RolesGuard` здесь не годится: он пропускает запрос, когда
 * `data.username` совпадает с текущим пайщиком, и любой сверял бы сам себя.
 */
@Injectable()
export class VerificationAuthorityService {
  constructor(
    @Inject(BRANCH_BLOCKCHAIN_PORT) private readonly branchBlockchainPort: BranchBlockchainPort,
  ) {}

  async assertMayVerify(actor: VerificationActor): Promise<void> {
    if (!actor.braname) {
      if (actor.role !== CHAIRMAN_ROLE) {
        throw new ForbiddenException('Подтверждать личность от имени совета вправе председатель совета');
      }
      return;
    }

    const branch = await this.branchBlockchainPort.getBranch(config.coopname, actor.braname);
    if (!branch) throw new ForbiddenException('Кооперативный участок не найден');

    const authorized = branch.trustee === actor.username || (branch.trusted ?? []).includes(actor.username);
    if (!authorized) {
      throw new ForbiddenException('Сверять личность на участке вправе его председатель или доверенное лицо');
    }
  }

  /** Отзыв верификации — только председатель совета, участок здесь роли не играет. */
  assertMayUnverify(actor: VerificationActor): void {
    if (actor.role !== CHAIRMAN_ROLE) {
      throw new ForbiddenException('Отзывать верификацию личности вправе председатель совета');
    }
  }

  /**
   * Проверка сверок, проведённых на участках: журнал, снимки, утверждение и
   * отклонение. Оператор участка сюда не заходит — он проверяемая сторона, и
   * снимки после отправки ему уже не показываются.
   */
  assertMayReview(actor: VerificationActor): void {
    if (actor.role !== CHAIRMAN_ROLE) {
      throw new ForbiddenException('Проверять сверку личности вправе председатель совета');
    }
  }
}
