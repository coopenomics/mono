import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { RobotVoteMode } from '../../domain/enums/robot-vote-mode.enum';

registerEnumType(RobotVoteMode, {
  name: 'RobotVoteMode',
  description: 'Режим голосования робота по типу решения: сразу при появлении повестки или повтором за другим членом совета',
});

@ObjectType('RobotFollowGroup', { description: 'Сколько голосов придёт вслед за одним членом совета' })
export class RobotFollowGroupDTO {
  @Field(() => String, { description: 'За кем повторяют' })
  follow!: string;

  @Field(() => Int, { description: 'Сколько членов совета повторяют за ним' })
  count!: number;
}

@ObjectType('RobotVoter', { description: 'Член совета, делегировавший роботу голос по типу решения' })
export class RobotVoterDTO {
  @Field(() => String, { description: 'Учётное имя члена совета' })
  member!: string;

  @Field(() => String, { description: 'Разрешение аккаунта с ключом робота' })
  permission_name!: string;

  @Field(() => Boolean, { description: 'Робот держит ключ этого разрешения' })
  has_key!: boolean;

  @Field(() => RobotVoteMode, { description: 'Голосует сразу или повторяет за другим членом совета' })
  mode!: RobotVoteMode;

  @Field(() => String, { nullable: true, description: 'За кем повторяет голос — в режиме повтора' })
  follow?: string | null;

  @Field(() => String, { description: 'Лимит суммы на одно решение; нулевой — без лимита' })
  limit!: string;

  @Field(() => String, { nullable: true, description: 'Срок действия делегирования; пусто — бессрочно' })
  expires_at?: string | null;
}

@ObjectType('RobotQuorum', { description: 'Кворум робота по типу решения' })
export class RobotQuorumDTO {
  @Field(() => Int, { description: 'Голоса, которые робот подаёт сразу: члены совета в режиме «сразу» с ключом у робота' })
  delegated_count!: number;

  @Field(() => [RobotFollowGroupDTO], { description: 'Голоса, которые придут вслед за ведомыми, по каждому ведомому' })
  follow_groups!: RobotFollowGroupDTO[];

  @Field(() => Int, { description: 'Сколько голосов «за» нужно по правилу совета' })
  required_count!: number;

  @Field(() => Int, { description: 'Состав совета' })
  total_members!: number;

  @Field(() => Boolean, { description: 'Кворум набирается голосами «сразу», без чьего-либо участия' })
  reached!: boolean;

  @Field(() => Boolean, { description: 'Кворум набирается, если ведомые проголосуют «за»: их голоса и голоса повторяющих за ними' })
  reachable!: boolean;
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

  @Field(() => Int, { description: 'Номер шаблона протокола в реестре документов' })
  protocol_registry_id!: number;

  @Field(() => [RobotVoterDTO], { description: 'Кто делегировал роботу голос по этому типу' })
  voters!: RobotVoterDTO[];

  @Field(() => RobotQuorumDTO, { description: 'Кворум робота' })
  vote_quorum!: RobotQuorumDTO;

  @Field(() => RobotChairmanDelegationDTO, { description: 'Автоматическая подпись протоколов' })
  chairman!: RobotChairmanDelegationDTO;

  @Field(() => [String], { description: 'Правила повтора, которые не сработают: замкнутый круг, ведомый без права голоса' })
  warnings!: string[];

  @Field(() => Boolean, { description: 'Текущий пользователь делегировал голос по этому типу' })
  my_vote!: boolean;

  @Field(() => RobotVoteMode, { nullable: true, description: 'Режим текущего пользователя по этому типу; пусто — голосует вручную' })
  my_mode?: RobotVoteMode | null;

  @Field(() => String, { nullable: true, description: 'За кем повторяет текущий пользователь — в режиме повтора' })
  my_follow?: string | null;

  @Field(() => Boolean, { description: 'Текущий пользователь (председатель) делегировал подпись протоколов этого типа' })
  my_authorize!: boolean;
}

@ObjectType('RobotCouncilMember', { description: 'Член совета кооператива' })
export class RobotCouncilMemberDTO {
  @Field(() => String, { description: 'Учётное имя' })
  username!: string;

  @Field(() => String, { description: 'ФИО пайщика для показа' })
  full_name!: string;

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
