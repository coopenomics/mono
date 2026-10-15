import { Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import { BRANCH_BLOCKCHAIN_PORT, type BranchBlockchainPort } from '~/domain/branch/interfaces/branch-blockchain.port';
import { DomainError } from '@coopenomics/extension-kit';

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

  /**
   * @param target — чью личность сверяют. На участке свою личность не сверяют:
   *   председатель участка и доверенное лицо выдали бы себе уровень сами.
   */
  async assertMayVerify(actor: VerificationActor, target?: string): Promise<void> {
    if (!actor.braname) {
      if (actor.role !== CHAIRMAN_ROLE) {
        throw DomainError.forbidden('AUTH_V2_VERIFICATION_CHAIRMAN_ONLY');
      }
      return;
    }

    if (target && target === actor.username) {
      throw DomainError.forbidden('AUTH_V2_VERIFICATION_SELF_FORBIDDEN');
    }

    const branch = await this.branchBlockchainPort.getBranch(config.coopname, actor.braname);
    if (!branch) throw DomainError.forbidden('AUTH_V2_BRANCH_NOT_FOUND');

    const authorized = branch.trustee === actor.username || (branch.trusted ?? []).includes(actor.username);
    if (!authorized) {
      throw DomainError.forbidden('AUTH_V2_VERIFICATION_BRANCH_AUTHORITY_ONLY');
    }
  }

  /** Отзыв верификации — только председатель совета, участок здесь роли не играет. */
  assertMayUnverify(actor: VerificationActor): void {
    if (actor.role !== CHAIRMAN_ROLE) {
      throw DomainError.forbidden('AUTH_V2_VERIFICATION_REVOKE_CHAIRMAN_ONLY');
    }
  }

  /**
   * Проверка сверок, проведённых на участках: журнал, снимки, утверждение и
   * отклонение. Оператор участка сюда не заходит — он проверяемая сторона, и
   * снимки после отправки ему уже не показываются.
   */
  assertMayReview(actor: VerificationActor): void {
    if (actor.role !== CHAIRMAN_ROLE) {
      throw DomainError.forbidden('AUTH_V2_VERIFICATION_REVIEW_CHAIRMAN_ONLY');
    }
  }
}
