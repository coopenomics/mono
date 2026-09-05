import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('RobotVoter', { description: 'Член совета, делегировавший роботу голос по типу решения' })
export class RobotVoterDTO {
  @Field(() => String, { description: 'Учётное имя члена совета' })
  member!: string;

  @Field(() => String, { description: 'Разрешение аккаунта с ключом робота' })
  permission_name!: string;

  @Field(() => Boolean, { description: 'Робот держит ключ этого разрешения' })
  has_key!: boolean;

  @Field(() => String, { description: 'Лимит суммы на одно решение; нулевой — без лимита' })
  limit!: string;

  @Field(() => String, { nullable: true, description: 'Срок действия делегирования; пусто — бессрочно' })
  expires_at?: string | null;
}

@ObjectType('RobotQuorum', { description: 'Кворум робота по типу решения' })
export class RobotQuorumDTO {
  @Field(() => Int, { description: 'Сколько голосующих членов совета делегировали голос и передали ключ' })
  delegated_count!: number;

  @Field(() => Int, { description: 'Сколько голосов «за» нужно по правилу совета' })
  required_count!: number;

  @Field(() => Int, { description: 'Состав совета' })
  total_members!: number;

  @Field(() => Boolean, { description: 'Робот набирает кворум сам, без ручных голосов' })
  reached!: boolean;
}

@ObjectType('RobotChairmanDelegation', { description: 'Автоматическая подпись протоколов председателем' })
export class RobotChairmanDelegationDTO {
  @Field(() => String, { nullable: true, description: 'Учётное имя председателя совета' })
  username?: string | null;

  @Field(() => Boolean, { description: 'Председатель делегировал роботу подпись протоколов этого типа' })
  delegated!: boolean;

  @Field(() => Boolean, { description: 'Робот держит ключ разрешения председателя' })
  has_key!: boolean;
}

@ObjectType('RobotDecisionType', { description: 'Тип решения совета в реестре действий автоматизации' })
export class RobotDecisionTypeDTO {
  @Field(() => String, { description: 'Тип решения в повестке совета' })
  type!: string;

  @Field(() => String, { description: 'Название решения' })
  title!: string;

  @Field(() => String, { description: 'О чём решение' })
  description!: string;

  @Field(() => String, { description: 'Область платформы, из которой приходит решение' })
  area!: string;

  @Field(() => Int, { nullable: true, description: 'Номер шаблона протокола в реестре документов' })
  protocol_registry_id?: number | null;

  @Field(() => Boolean, { description: 'Робот умеет довести этот тип решения до протокола' })
  serviceable!: boolean;

  @Field(() => [RobotVoterDTO], { description: 'Кто делегировал роботу голос по этому типу' })
  voters!: RobotVoterDTO[];

  @Field(() => RobotQuorumDTO, { description: 'Кворум робота' })
  vote_quorum!: RobotQuorumDTO;

  @Field(() => RobotChairmanDelegationDTO, { description: 'Автоматическая подпись протоколов' })
  chairman!: RobotChairmanDelegationDTO;

  @Field(() => Boolean, { description: 'Текущий пользователь делегировал голос по этому типу' })
  my_vote!: boolean;

  @Field(() => Boolean, { description: 'Текущий пользователь (председатель) делегировал подпись протоколов этого типа' })
  my_authorize!: boolean;
}

@ObjectType('RobotCouncilMember', { description: 'Член совета кооператива' })
export class RobotCouncilMemberDTO {
  @Field(() => String, { description: 'Учётное имя' })
  username!: string;

  @Field(() => Boolean, { description: 'Имеет право голоса' })
  is_voting!: boolean;

  @Field(() => String, { description: 'Должность в совете' })
  position!: string;

  @Field(() => String, { description: 'Название должности' })
  position_title!: string;
}

@ObjectType('RobotCouncil', { description: 'Совет кооператива глазами робота' })
export class RobotCouncilDTO {
  @Field(() => Int, { description: 'Идентификатор совета в контракте' })
  board_id!: number;

  @Field(() => String, { nullable: true, description: 'Председатель совета' })
  chairman?: string | null;

  @Field(() => Int, { description: 'Сколько голосов «за» нужно по правилу совета' })
  required_votes!: number;

  @Field(() => [RobotCouncilMemberDTO], { description: 'Состав совета' })
  members!: RobotCouncilMemberDTO[];
}
