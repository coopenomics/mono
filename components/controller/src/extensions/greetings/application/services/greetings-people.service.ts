import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_PORT,
  COOPERATIVE_VARS_PORT,
  USER_DIRECTORY_PORT,
  type IAccountPort,
  type ICooperativeVarsPort,
  type IUserDirectoryPort,
  type InnerAccount,
} from '@coopenomics/innercoop';
import { GreetingAccountType } from '../../domain/greetings.enums';
import { t } from '../../i18n';
import type { GreetingSubject } from '../../domain/greeting-letter';

/** Личные данные пайщика, которые приложение читает у ядра. */
export interface GreetingPerson {
  username: string;
  account: InnerAccount;
  accountType: GreetingAccountType | null;
  lastName: string;
  firstName: string;
  middleName: string;
  birthdate: string | null;
}

/** Блок личных данных пайщика, в котором лежат ФИО и дата рождения. */
function personalBlock(account: InnerAccount): { type: GreetingAccountType | null; data: Record<string, any> } {
  const privateAccount = account.private_account;
  if (privateAccount?.individual_data) return { type: GreetingAccountType.INDIVIDUAL, data: privateAccount.individual_data };
  if (privateAccount?.entrepreneur_data) return { type: GreetingAccountType.ENTREPRENEUR, data: privateAccount.entrepreneur_data };
  return { type: null, data: {} };
}

/** Пайщик глазами приложения: ФИО и дата рождения из ядра. */
export function toGreetingPerson(account: InnerAccount): GreetingPerson {
  const { type, data } = personalBlock(account);
  return {
    username: account.username,
    account,
    accountType: type,
    lastName: String(data.last_name ?? ''),
    firstName: String(data.first_name ?? ''),
    middleName: String(data.middle_name ?? ''),
    birthdate: data.birthdate ? String(data.birthdate) : null,
  };
}

/**
 * Данные пайщиков и кооператива для писем.
 *
 * ФИО читается у ядра в день отправки, а не хранится в календаре: так письмо
 * получает исправленные данные, а приложение не держит копию личных данных.
 */
@Injectable()
export class GreetingsPeopleService {
  constructor(
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    @Inject(COOPERATIVE_VARS_PORT) private readonly cooperativeVars: ICooperativeVarsPort,
    @Inject(USER_DIRECTORY_PORT) private readonly users: IUserDirectoryPort
  ) {}

  async person(username: string): Promise<GreetingPerson> {
    return toGreetingPerson(await this.accounts.getAccount(username));
  }

  async displayName(username: string): Promise<string> {
    return this.accounts.getDisplayName(username);
  }

  /** Страница пайщиков кооператива — для первого заполнения календаря. */
  async page(page: number, limit: number): Promise<{ people: GreetingPerson[]; totalPages: number }> {
    const result = await this.accounts.getAccounts({}, { page, limit, sortOrder: 'ASC' });
    return { people: result.items.map(toGreetingPerson), totalPages: result.totalPages };
  }

  /** Подпись письма: краткое название кооператива и ФИО председателя. */
  async signature(): Promise<{ cooperative: string; chairman: string }> {
    const vars = await this.cooperativeVars.get();
    const [chairman] = await this.users.findByRoles(['chairman']);
    return {
      // В реквизитах сокращение и имя лежат раздельно: «ПК» и «Восход».
      cooperative: vars ? t('greetings.letter.cooperative', { shortAbbr: vars.shortAbbr, name: vars.name }) : '',
      chairman: chairman ? await this.accounts.getDisplayName(chairman.username) : '',
    };
  }

  /** Данные для переменных письма; `age` — сколько исполняется в `year`. */
  subject(person: GreetingPerson, age: number | null, signature: { cooperative: string; chairman: string }): GreetingSubject {
    return {
      lastName: person.lastName,
      firstName: person.firstName,
      middleName: person.middleName,
      age,
      cooperative: signature.cooperative,
      chairman: signature.chairman,
    };
  }
}
