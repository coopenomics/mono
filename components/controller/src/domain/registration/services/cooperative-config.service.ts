import { Injectable } from '@nestjs/common';
import { AccountType } from '~/application/account/enum/account-type.enum';

/**
 * Сервис для определения конфигурации кооперативов.
 *
 * После Эпика 1.3 фильтрация оферт по кооперативу больше не делается —
 * расширения сами решают, регистрировать ли свои оферты, поэтому метод
 * getExcludedFromBaseAgreements удалён. Метод hasPrograms/`getCooperativesWithPrograms`
 * остаётся для feature-флага в SignUp (стоит ли вообще опрашивать программы).
 */
@Injectable()
export class CooperativeConfigService {
  /**
   * Получить список кооперативов, которые поддерживают программы регистрации
   */
  getCooperativesWithPrograms(): string[] {
    return ['voskhod'];
  }

  /**
   * Проверить, поддерживает ли кооператив программы регистрации
   */
  hasPrograms(coopname: string): boolean {
    return this.getCooperativesWithPrograms().includes(coopname);
  }

  /**
   * Дополнительные платформенные соглашения, которые включаются по
   * правилам кооператива (а не через расширения). Сейчас всегда пусто —
   * хук оставлен для будущей кастомизации.
   */
  getDefaultAdditionalAgreements(_coopname: string, _accountType: AccountType): string[] {
    return [];
  }
}
