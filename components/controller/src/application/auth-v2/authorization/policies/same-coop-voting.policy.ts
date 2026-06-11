import { Inject } from '@nestjs/common';
import config from '~/config/config';
import { VAULT_REPOSITORY, type IVaultRepository } from '~/domain/auth-v2/vault/vault-repository.port';
import { PolicyHandler } from '../policy-handler.decorator';
import type { IPolicyHandler, PolicyEvaluationContext } from '../policy.types';

/**
 * Политика Layer 3 «голосовать можно только в своём кооперативе» (Story 6.3). Пример
 * правила, которое нельзя выразить статической матрицей: нужен runtime DB-lookup.
 *
 * Контроллер обслуживает один кооператив (`config.coopname`). Голосовать вправе только
 * зарегистрированный пайщик этого кооператива — критерий членства = наличие CoopID-vault
 * (`subject_type='participant'`) в coop_domain_db (это и есть DB-lookup; сервер читает
 * только факт существования зашифрованного блоба, не расшифровывая его — инвариант CoopID).
 * Если в запросе указан coopname решения, он обязан совпасть с обслуживаемым.
 */
@PolicyHandler('same-coop-voting')
export class SameCoopVotingPolicy implements IPolicyHandler {
  readonly name = 'same-coop-voting';

  constructor(
    @Inject(VAULT_REPOSITORY)
    private readonly vaults: IVaultRepository,
  ) {}

  async evaluate(context: PolicyEvaluationContext): Promise<boolean> {
    const username = context.user.username;
    if (!username) return false;

    // Решение чужого кооператива — сразу отказ (контроллер per-coop).
    const decisionCoop = context.resource?.coopname;
    if (typeof decisionCoop === 'string' && decisionCoop !== config.coopname) return false;

    // DB-lookup: членство = существование участникового vault в этом кооперативе.
    const vault = await this.vaults.find({ subject_type: 'participant', subject_id: username });
    return vault !== null;
  }
}
