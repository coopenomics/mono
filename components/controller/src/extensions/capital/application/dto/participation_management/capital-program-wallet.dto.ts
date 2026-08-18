import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ProgramType, type InnerProgramWallet } from '@coopenomics/innercoop';

/**
 * Кошелёк участника в целевой программе — так, как его показывает capital.
 *
 * Форма кошелька приходит из контракта простым объектом (`InnerProgramWallet`),
 * а вид в схеме расширение объявляет само (INV-003: в контракте нет ни
 * `@ObjectType`, ни `@Field`). Ядро показывает тот же кошелёк под именем
 * `ProgramWallet` в своём разделе схемы; здесь он живёт отдельно, потому что
 * принадлежит участнику capital'а и уедет вместе с расширением.
 */
@ObjectType('CapitalProgramWallet')
export class CapitalProgramWalletDTO {
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

  /** Собрать вид из того, что отдал порт кошельков. */
  static fromPort(wallet: InnerProgramWallet): CapitalProgramWalletDTO {
    const dto = new CapitalProgramWalletDTO();
    dto.id = wallet.id as string;
    dto.coopname = wallet.coopname as string;
    dto.program_id = wallet.program_id as string;
    dto.program_type = wallet.program_type ?? null;
    dto.agreement_id = wallet.agreement_id as string;
    dto.username = wallet.username as string;
    dto.available = wallet.available as string;
    dto.membership_contribution = wallet.membership_contribution as string;
    return dto;
  }
}
