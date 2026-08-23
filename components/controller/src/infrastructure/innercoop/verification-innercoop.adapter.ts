import { Injectable } from '@nestjs/common';
import type { IVerificationPort, InnerVerificationCheck, InnerVerificationEntry } from '@coopenomics/innercoop';
import { VerificationTypesService } from '~/application/auth-v2/verification/verification-types.service';
import { VerificationRulesService } from '~/application/auth-v2/verification/verification-rules.service';

/**
 * Реализация `IVerificationPort` поверх сводного резолвера уровней верификации
 * и правил кооператива (auth-v2). Расширения через порт узнают уровни пайщика
 * и проверяют достаточность для действия, не зная внутренностей ядра.
 */
@Injectable()
export class VerificationInnercoopAdapter implements IVerificationPort {
  constructor(
    private readonly verificationTypesService: VerificationTypesService,
    private readonly verificationRulesService: VerificationRulesService,
  ) {}

  async getVerificationTypes(username: string): Promise<InnerVerificationEntry[]> {
    const entries = await this.verificationTypesService.resolveForUsername(username);
    return entries.map((entry) => ({
      type: entry.type,
      verified_at: entry.verified_at,
      ...(entry.attested_by ? { attested_by: entry.attested_by } : {}),
    }));
  }

  async checkRequired(username: string, actionCode: string): Promise<InnerVerificationCheck> {
    const required = await this.verificationRulesService.getRequiredTypes(actionCode);
    if (!required.length) return { passed: true, missing: [] };

    const entries = await this.verificationTypesService.resolveForUsername(username);
    const present = new Set<string>(entries.map((entry) => entry.type));
    const missing = required.filter((type) => !present.has(type));
    return { passed: missing.length === 0, missing };
  }
}
