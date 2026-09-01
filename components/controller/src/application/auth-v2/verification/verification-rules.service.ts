import { Inject, Injectable } from '@nestjs/common';
import {
  VERIFICATION_RULE_REPOSITORY,
  type IVerificationRuleRepository,
} from '~/domain/auth-v2/ports/verification-rule.port';
import { VerificationType, type VerificationRule } from '~/domain/auth-v2/verification/verification.types';

const VALID_TYPES = new Set<string>(Object.values(VerificationType));

/**
 * Per-coop правила применения типов верификации (Story 4.2). Кооператив задаёт,
 * какие типы верификации обязательны для действия (`action_code`). Источник
 * требований для `VerificationRuleGuard`; запись правил — `saveRule` (поверхность —
 * chairman-эндпоинт/admin-UI — отдельной историей, см. spec-4-2).
 */
@Injectable()
export class VerificationRulesService {
  constructor(
    @Inject(VERIFICATION_RULE_REPOSITORY) private readonly repository: IVerificationRuleRepository,
  ) {}

  /** Все правила кооператива (для admin-UI). */
  list(): Promise<VerificationRule[]> {
    return this.repository.list();
  }

  /** Обязательные типы верификации для действия; пусто, если правило не задано. */
  async getRequiredTypes(actionCode: string): Promise<VerificationType[]> {
    const rule = await this.repository.findByActionCode(actionCode);
    return rule?.required_types ?? [];
  }

  /**
   * Создать/перезаписать правило действия. Дедуплицирует и валидирует типы
   * (неизвестные значения отбрасываются) — в хранилище попадает чистый набор enum.
   */
  async saveRule(actionCode: string, requiredTypes: VerificationType[]): Promise<VerificationRule> {
    const required_types = [...new Set(requiredTypes)].filter((t) => VALID_TYPES.has(t));
    const rule: VerificationRule = { action_code: actionCode, required_types };
    await this.repository.upsert(rule);
    return rule;
  }
}
