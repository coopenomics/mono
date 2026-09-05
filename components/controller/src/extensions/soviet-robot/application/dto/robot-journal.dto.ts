import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { RobotDecisionStage } from '../../domain/enums/robot-decision-stage.enum';

registerEnumType(RobotDecisionStage, {
  name: 'RobotDecisionStage',
  description: 'Этап решения в журнале робота совета',
});

@ObjectType('RobotVoteRecord', { description: 'Голос, поданный роботом от имени члена совета' })
export class RobotVoteRecordDTO {
  @Field(() => String, { description: 'Член совета' })
  member!: string;

  @Field(() => String, { description: 'Разрешение аккаунта, ключом которого подписан голос' })
  permission!: string;

  @Field(() => String, { description: 'Транзакция голоса' })
  tx_id!: string;

  @Field(() => String, { description: 'Когда подан' })
  at!: string;
}

@ObjectType('RobotDecision', { description: 'Решение совета в журнале робота' })
export class RobotDecisionDTO {
  @Field(() => String, { description: 'Идентификатор записи журнала' })
  id!: string;

  @Field(() => String, { description: 'Кооператив' })
  coopname!: string;

  @Field(() => Int, { description: 'Номер решения совета' })
  decision_id!: number;

  @Field(() => String, { description: 'Тип решения' })
  decision_type!: string;

  @Field(() => String, { description: 'Хэш повестки' })
  decision_hash!: string;

  @Field(() => String, { description: 'Кто подал повестку' })
  username!: string;

  @Field(() => RobotDecisionStage, { description: 'Этап обработки' })
  stage!: RobotDecisionStage;

  @Field(() => [RobotVoteRecordDTO], { description: 'Голоса, поданные роботом' })
  votes!: RobotVoteRecordDTO[];

  @Field(() => String, { nullable: true, description: 'Хэш протокола, подписанного роботом' })
  protocol_hash?: string | null;

  @Field(() => [String], { description: 'Транзакции робота по этому решению' })
  tx_hashes!: string[];

  @Field(() => String, { nullable: true, description: 'Последняя ошибка' })
  last_error?: string | null;

  @Field(() => Int, { description: 'Число неудачных попыток' })
  attempts!: number;

  @Field(() => Date, { nullable: true, description: 'Время следующей попытки' })
  next_attempt_at?: Date | null;

  @Field(() => Date, { description: 'Создано' })
  created_at!: Date;

  @Field(() => Date, { description: 'Обновлено' })
  updated_at!: Date;
}
