import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ProjectRole } from '../../../domain/enums/role-request.enum';

/**
 * Допуск к роли на компоненте оформляется без юридического документа:
 * заявка, приглашение и решение по ним фиксируются подписью операции.
 */

@InputType('RequestProjectRoleInput')
export class RequestProjectRoleInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор заявки' })
  @IsNotEmpty()
  @IsString()
  request_hash!: string;

  @Field(() => String, { description: 'Идентификатор проекта или компонента' })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => String, { description: 'Пайщик, который просит допуск' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Мастер компонента, который принимает решение' })
  @IsNotEmpty()
  @IsString()
  master!: string;

  @Field(() => ProjectRole, { description: 'Роль, к которой запрашивается допуск' })
  @IsEnum(ProjectRole)
  role!: ProjectRole;

  @Field(() => String, { description: 'Желаемая ставка часа, например «1200.0000 RUB»' })
  @IsNotEmpty()
  @IsString()
  rate_per_hour!: string;

  @Field(() => Int, { description: 'Желаемая норма часов в день, от 1 до 8' })
  @IsInt()
  @Min(1)
  @Max(8)
  hours_per_day!: number;

  @Field(() => String, { description: 'Текст заявки', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType('ApproveProjectRoleInput')
export class ApproveProjectRoleInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор заявки' })
  @IsNotEmpty()
  @IsString()
  request_hash!: string;

  @Field(() => String, { description: 'Мастер компонента, который принимает решение' })
  @IsNotEmpty()
  @IsString()
  master!: string;

  @Field(() => String, { description: 'Утверждённая ставка часа, например «1200.0000 RUB»' })
  @IsNotEmpty()
  @IsString()
  approved_rate!: string;

  @Field(() => Int, { description: 'Утверждённая норма часов в день, от 1 до 8' })
  @IsInt()
  @Min(1)
  @Max(8)
  approved_hours!: number;
}

@InputType('DeclineProjectRoleInput')
export class DeclineProjectRoleInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор заявки' })
  @IsNotEmpty()
  @IsString()
  request_hash!: string;

  @Field(() => String, { description: 'Мастер компонента, который принимает решение' })
  @IsNotEmpty()
  @IsString()
  master!: string;

  @Field(() => String, { description: 'Причина отказа' })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

@InputType('InviteProjectRoleInput')
export class InviteProjectRoleInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор приглашения' })
  @IsNotEmpty()
  @IsString()
  request_hash!: string;

  @Field(() => String, { description: 'Идентификатор проекта или компонента' })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => String, { description: 'Приглашаемый пайщик' })
  @IsNotEmpty()
  @IsString()
  candidate!: string;

  @Field(() => String, { description: 'Мастер компонента, который приглашает' })
  @IsNotEmpty()
  @IsString()
  master!: string;

  @Field(() => ProjectRole, { description: 'Предлагаемая роль' })
  @IsEnum(ProjectRole)
  role!: ProjectRole;

  @Field(() => String, { description: 'Предлагаемая ставка часа, например «1200.0000 RUB»' })
  @IsNotEmpty()
  @IsString()
  rate_per_hour!: string;

  @Field(() => Int, { description: 'Предлагаемая норма часов в день, от 1 до 8' })
  @IsInt()
  @Min(1)
  @Max(8)
  hours_per_day!: number;

  @Field(() => String, { description: 'Текст приглашения', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType('AcceptProjectRoleInviteInput')
export class AcceptProjectRoleInviteInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор приглашения' })
  @IsNotEmpty()
  @IsString()
  request_hash!: string;

  @Field(() => String, { description: 'Приглашённый пайщик' })
  @IsNotEmpty()
  @IsString()
  username!: string;
}

@InputType('DeclineProjectRoleInviteInput')
export class DeclineProjectRoleInviteInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор приглашения' })
  @IsNotEmpty()
  @IsString()
  request_hash!: string;

  @Field(() => String, { description: 'Приглашённый пайщик' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Причина отказа' })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

@InputType('RequestRateUpdateInput')
export class RequestRateUpdateInputDTO {
  @Field(() => String, { description: 'Название кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор заявки' })
  @IsNotEmpty()
  @IsString()
  request_hash!: string;

  @Field(() => String, { description: 'Идентификатор проекта или компонента' })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => String, { description: 'Пайщик, который просит изменить ставку' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Мастер компонента, который принимает решение' })
  @IsNotEmpty()
  @IsString()
  master!: string;

  @Field(() => String, { description: 'Желаемая ставка часа, например «1400.0000 RUB»' })
  @IsNotEmpty()
  @IsString()
  new_rate!: string;

  @Field(() => Int, { description: 'Желаемая норма часов в день, от 1 до 8' })
  @IsInt()
  @Min(1)
  @Max(8)
  new_hours!: number;

  @Field(() => String, { description: 'Обоснование', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
