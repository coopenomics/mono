import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ForceRecoveryConsentVia } from '../force-recovery.service';

registerEnumType(ForceRecoveryConsentVia, {
  name: 'ForceRecoveryConsentVia',
  description: 'Чем подтверждено принудительное восстановление: согласием пайщика или решением собрания',
});

/** Результат авторизации принудительного восстановления председателем. */
@ObjectType('ForceRecoveryAuthorization')
export class ForceRecoveryAuthorizationDTO {
  @Field(() => Boolean, { description: 'Восстановление авторизовано' })
  authorized!: boolean;

  @Field(() => ForceRecoveryConsentVia, { description: 'Чем подтверждено восстановление' })
  consent_via!: ForceRecoveryConsentVia;

  @Field(() => String, { description: 'Кто инициировал (председатель)' })
  triggered_by!: string;
}

/** Вход на запрос согласия пайщика на принудительное восстановление. */
@InputType('RequestForceRecoveryConsentInput')
export class RequestForceRecoveryConsentInputDTO {
  @Field(() => String, { description: 'Пайщик, для которого запрашивается согласие' })
  target_id!: string;
}

/** Вход на авторизацию принудительного восстановления председателем. */
@InputType('AuthorizeForceRecoveryInput')
export class AuthorizeForceRecoveryInputDTO {
  @Field(() => String, { description: 'Пайщик, для которого авторизуется восстановление' })
  target_id!: string;

  @Field(() => String, { nullable: true, description: 'Идентификатор транзакции решения собрания (если основание — собрание)' })
  assembly_decision_tx_id?: string | null;
}
