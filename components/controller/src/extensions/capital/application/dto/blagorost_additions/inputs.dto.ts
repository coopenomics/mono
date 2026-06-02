import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsInt, Min } from 'class-validator';

// ─── Долги: закрытие невозврата / ретрай платежа / просрочка ───

@InputType('CloseDebtInput')
export class CloseDebtInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() debt_hash!: string;
}

@InputType('DebtPayRetryInput')
export class DebtPayRetryInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() debt_hash!: string;
}

@InputType('MarkDebtOverdueInput')
export class MarkDebtOverdueInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
}

// ─── L2-допуски и обновление ставки ───

@InputType('RequestRoleInput')
export class RequestRoleInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() request_hash!: string;
  @Field(() => String) @IsNotEmpty() @IsString() project_hash!: string;
  @Field(() => String) @IsNotEmpty() @IsString() username!: string;
  @Field(() => String) @IsNotEmpty() @IsString() master!: string;
  @Field(() => String, { description: 'creator | author | coordinator' })
  @IsNotEmpty() @IsString() role!: string;
  @Field(() => String, { description: 'Желаемая ставка часа (asset)' })
  @IsNotEmpty() @IsString() rate_per_hour!: string;
  @Field(() => Int) @IsInt() @Min(1) hours_per_day!: number;
  @Field(() => String, { description: 'Текст заявления' })
  @IsNotEmpty() @IsString() description!: string;
}

@InputType('ApproveRoleInput')
export class ApproveRoleInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() request_hash!: string;
  @Field(() => String, { description: 'Утверждённая ставка часа (asset)' })
  @IsNotEmpty() @IsString() approved_rate!: string;
  @Field(() => Int) @IsInt() @Min(1) approved_hours!: number;
}

@InputType('DeclineRoleInput')
export class DeclineRoleInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() request_hash!: string;
  @Field(() => String, { description: 'Причина отклонения' })
  @IsNotEmpty() @IsString() reason!: string;
}

@InputType('InviteRoleInput')
export class InviteRoleInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() request_hash!: string;
  @Field(() => String) @IsNotEmpty() @IsString() project_hash!: string;
  @Field(() => String, { description: 'Кандидат на L2-допуск' })
  @IsNotEmpty() @IsString() candidate!: string;
  @Field(() => String) @IsNotEmpty() @IsString() master!: string;
  @Field(() => String, { description: 'creator | author | coordinator' })
  @IsNotEmpty() @IsString() role!: string;
  @Field(() => String) @IsNotEmpty() @IsString() rate_per_hour!: string;
  @Field(() => Int) @IsInt() @Min(1) hours_per_day!: number;
  @Field(() => String) @IsNotEmpty() @IsString() description!: string;
}

@InputType('AcceptInviteInput')
export class AcceptInviteInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() request_hash!: string;
}

@InputType('DeclineInviteInput')
export class DeclineInviteInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() request_hash!: string;
  @Field(() => String, { description: 'Причина отклонения' })
  @IsNotEmpty() @IsString() reason!: string;
}

@InputType('RequestRateUpdateInput')
export class RequestRateUpdateInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString() coopname!: string;
  @Field(() => String) @IsNotEmpty() @IsString() request_hash!: string;
  @Field(() => String) @IsNotEmpty() @IsString() project_hash!: string;
  @Field(() => String) @IsNotEmpty() @IsString() username!: string;
  @Field(() => String) @IsNotEmpty() @IsString() master!: string;
  @Field(() => String) @IsNotEmpty() @IsString() new_rate!: string;
  @Field(() => Int) @IsInt() @Min(1) new_hours!: number;
  @Field(() => String) @IsNotEmpty() @IsString() description!: string;
}
