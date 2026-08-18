import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { NodeSyncOutage, NodeSyncStatus } from '../enum/node-sync-status.enum';

@ObjectType('NodeSyncState', {
  description: 'Насколько узел кооператива отстал от цепи и когда догонит',
})
export class NodeSyncStateDTO {
  @Field(() => NodeSyncStatus, {
    description: 'Готов ли узел к работе: у головы цепи, догоняет или связи нет',
  })
  status!: NodeSyncStatus;

  @Field(() => NodeSyncOutage, {
    nullable: true,
    description: 'Что оборвалось, если связи нет',
  })
  outage?: NodeSyncOutage;

  @Field(() => Int, {
    nullable: true,
    description: 'Блок, до которого узел прочитал цепь',
  })
  current_block_num?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Последний блок цепи',
  })
  head_block_num?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Сколько блоков осталось прочитать',
  })
  lag_blocks?: number;

  @Field(() => Float, {
    nullable: true,
    description: 'С какой скоростью сокращается отставание, блоков в секунду',
  })
  catch_up_blocks_per_second?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Сколько секунд осталось до конца догона по текущей скорости',
  })
  estimated_seconds_remaining?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Когда узел в последний раз продвинулся по цепи',
  })
  cursor_updated_at?: string;
}
