import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ProgramType } from '~/domain/wallet/enums/program-type.enum';

/**
 * DTO для программного кошелька
 * Представляет кошелек участника в целевой потребительской программе
 */
@ObjectType('ProgramWallet')
export class ProgramWalletDTO {
  @Field(() => ID, { description: 'Уникальный идентификатор кошелька в блокчейне' })
  id!: string;

  @Field(() => String, { description: 'Имя кооператива' })
  coopname!: string;

  @Field(() => ID, { description: 'Идентификатор программы' })
  program_id!: string;

  @Field(() => ProgramType, { nullable: true, description: 'Тип программы' })
  program_type?: ProgramType | null;

  @Field(() => ID, { description: 'Идентификатор соглашения' })
  agreement_id!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  username!: string;

  @Field(() => String, { description: 'Доступный баланс (формат: "100.0000 RUB")' })
  available!: string;

  @Field(() => String, { description: 'Паевой взнос (формат: "100.0000 RUB")' })
  membership_contribution!: string;

  @Field(() => Number, { nullable: true, description: 'Номер блока последнего обновления' })
  blockNum?: number;

  /**
   * Создать DTO из доменной сущности
   */
  static fromDomain(entity: any): ProgramWalletDTO {
    const dto = new ProgramWalletDTO();
    dto.id = entity.id;
    dto.coopname = entity.coopname;
    dto.program_id = entity.program_id;
    dto.program_type = entity.program_type;
    dto.agreement_id = entity.agreement_id;
    dto.username = entity.username;
    dto.available = entity.available;
    dto.membership_contribution = entity.membership_contribution;
    dto.blockNum = entity.blockNum;
    return dto;
  }
}
