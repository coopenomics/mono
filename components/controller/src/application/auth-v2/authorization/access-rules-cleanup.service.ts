import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ACCESS_RULES_REPOSITORY,
  type IAccessRulesRepository,
} from '~/domain/auth-v2/ports/access-rules.port';

/**
 * Фоновая уборка истёкших точечных прав `access_rules` (Story 6.7, TTL capability).
 *
 * Истёкшие правила УЖЕ инертны: read-path (`findForPrincipal`/`findForCapabilitySets`)
 * исключает их по `expires_at <= now()`, доступа они не дают. Этот cron лишь удаляет
 * мёртвые строки, чтобы таблица не росла бесконечно (гигиена + скорость выборки прав).
 * Удаление безопасно по построению — трогает только строки с непустым `expires_at` в
 * прошлом; бессрочные и ещё действующие не затрагиваются. Без отзыва сессий и без
 * аудита: ничьи фактические права не меняются (в отличие от явной revoke в 6.7-UI).
 *
 * Прецедент cron'а в auth-v2 — `CriticalActionsService.expireStale` (Story 6.8).
 */
@Injectable()
export class AccessRulesCleanupService {
  private readonly logger = new Logger(AccessRulesCleanupService.name);

  constructor(
    @Inject(ACCESS_RULES_REPOSITORY)
    private readonly accessRules: IAccessRulesRepository,
  ) {}

  /** Cron: ежедневно в полночь удаляет истёкшие capability-правила. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpired(): Promise<void> {
    const removed = await this.accessRules.deleteExpired(new Date());
    if (removed) this.logger.log(`access_rules: удалено истёкших правил=${removed}`);
  }
}
