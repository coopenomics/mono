import type { ICooperativeRegistrationPrograms } from './agreement-config.interface';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { ProgramKey, AgreementId } from '../enum';

/**
 * Конфигурация программ регистрации для разных кооперативов.
 * Здесь определяются доступные программы, их описания и связанные соглашения.
 */
export const REGISTRATION_PROGRAMS_CONFIG: ICooperativeRegistrationPrograms[] = [
  {
    coopname: 'voskhod',
    requires_selection: true,
    programs: [
      {
        key: ProgramKey.GENERATION,
        title: 'Программа Генерация',
        description:
          'Участвовать в производстве Кооперативной Экономики через вклад временем, имуществом или деньгами в конкретные проекты.',
        applicable_account_types: [AccountType.individual, AccountType.entrepreneur],
        agreement_ids: [AgreementId.GENERATOR_OFFER],
        order: 1,
      },
      {
        key: ProgramKey.CAPITALIZATION,
        title: 'Программа Благорост',
        description:
          'Участвовать в производстве Кооперативной Экономики через вклад имуществом или денег в систему. Минимальный взнос 100 000 руб в течение 14 дней.',
        applicable_account_types: [AccountType.individual, AccountType.entrepreneur],
        agreement_ids: [AgreementId.BLAGOROST_OFFER],
        order: 2,
      },
    ],
  },
];
