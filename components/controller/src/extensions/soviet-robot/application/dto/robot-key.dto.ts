import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

@ObjectType('RobotKeyStatus', { description: 'Состояние ключа робота у члена совета' })
export class RobotKeyStatusDTO {
  @Field(() => String, { description: 'Член совета' })
  member!: string;

  @Field(() => String, { description: 'Разрешение аккаунта с ключом робота' })
  permission_name!: string;

  @Field(() => Boolean, { description: 'Робот держит ключ' })
  has_key!: boolean;

  @Field(() => String, { nullable: true, description: 'Публичный ключ, который держит робот' })
  public_key?: string | null;

  @Field(() => Boolean, { description: 'На аккаунте есть разрешение робота' })
  chain_has_permission!: boolean;

  @Field(() => Boolean, { description: 'Ключ у робота совпадает с ключом разрешения в цепи' })
  chain_key_matches!: boolean;

  @Field(() => Date, { nullable: true, description: 'Когда ключ передан' })
  updated_at?: Date | null;
}

@InputType('RobotDelegateKeyInput', { description: 'Передача роботу приватного ключа разрешения' })
export class RobotDelegateKeyInputDTO {
  @Field(() => String, { description: 'Приватный ключ разрешения робота (WIF); передаётся один раз и не хранится на устройстве' })
  @IsString()
  @Matches(/^(5[HJK][1-9A-HJ-NP-Za-km-z]{49}|PVT_K1_[1-9A-HJ-NP-Za-km-z]{50,60})$/, { message: 'Ожидается приватный ключ в формате WIF' })
  wif!: string;

  @Field(() => String, { nullable: true, description: 'Имя разрешения; по умолчанию robot' })
  @IsOptional()
  @IsString()
  permission_name?: string;
}

@InputType('RobotRetryDecisionInput', { description: 'Ручной повтор застрявшего решения' })
export class RobotRetryDecisionInputDTO {
  @Field(() => Int, { description: 'Номер решения совета' })
  @IsInt()
  @Min(1)
  decision_id!: number;
}
