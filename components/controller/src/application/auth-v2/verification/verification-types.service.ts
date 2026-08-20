import { Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import {
  VERIFICATION_SOURCE_RESOLVERS,
  type IVerificationSourceResolver,
} from '~/domain/auth-v2/ports/verification-source.port';
import type { VerificationTypeEntry } from '~/domain/auth-v2/verification/verification.types';

/**
 * Сводный резолвер типов верификации пайщика (CoopID, Stories 4.1/4.2).
 * Уровни собираются из набора независимых источников (`IVerificationSourceResolver`):
 * `coop_baseline` — из членства, `passport_onsite` — из он-чейн записей
 * кооперативного участка; будущие уровни добавляются новым резолвером в набор
 * (`VERIFICATION_SOURCE_RESOLVERS` в auth-v2.module), без изменения этого сервиса.
 * Дубликаты по типу схлопываются — выигрывает более ранний источник в наборе.
 */
@Injectable()
export class VerificationTypesService {
  constructor(
    @Inject(VERIFICATION_SOURCE_RESOLVERS) private readonly resolvers: IVerificationSourceResolver[],
  ) {}

  /**
   * Типы верификации пайщика по имени блокчейн-аккаунта. Пустой массив, если ни один
   * источник ничего не подтвердил (например, пайщик не является принятым членом).
   */
  async resolveForUsername(username: string, coopname: string = config.coopname): Promise<VerificationTypeEntry[]> {
    const results = await Promise.all(this.resolvers.map((resolver) => resolver.resolve(username, coopname)));

    const merged: VerificationTypeEntry[] = [];
    const seen = new Set<string>();
    for (const entry of results.flat()) {
      if (seen.has(entry.type)) continue;
      seen.add(entry.type);
      merged.push(entry);
    }
    return merged;
  }
}
