import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('ReportsParticipant', { description: 'Пайщик в реестрах стола бухгалтера: учётное имя и имя для показа' })
export class ReportsParticipantDTO {
  @Field(() => String, { description: 'Учётное имя пайщика' })
  username!: string;

  @Field(() => String, { description: 'ФИО пайщика или название организации' })
  name!: string;
}

@ObjectType('ReportsParticipantWallet', { description: 'Кошелёк пайщика по программе кооператива' })
export class ReportsParticipantWalletDTO {
  @Field(() => String, { description: 'Учётное имя пайщика' })
  username!: string;

  @Field(() => String, { description: 'Идентификатор программы' })
  program_id!: string;

  @Field(() => String, { description: 'Доступный остаток' })
  available!: string;
}

@ObjectType('ReportsSubject', { description: 'Субъект операции в реестрах стола бухгалтера: пайщик, организация, участок или кооператив' })
export class ReportsSubjectDTO {
  @Field(() => String, { description: 'Учётное имя' })
  username!: string;

  @Field(() => String, { description: 'ФИО или название для показа' })
  name!: string;

  @Field(() => String, { description: 'Вид субъекта: пайщик, кооперативный участок, кооператив' })
  account_kind!: string;
}
