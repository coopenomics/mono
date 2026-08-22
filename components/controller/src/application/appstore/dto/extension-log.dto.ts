// modules/appstore/dto/extension-log.dto.ts
import { ObjectType, Field } from '@nestjs/graphql';
import { LogExtensionDomainEntity } from '@coopenomics/extension-kit';

@ObjectType('ExtensionLog')
export class ExtensionLogDTO<TLog = any> {
  @Field(() => Number, { description: 'Глобальный ID записи лога' })
  public readonly id: number;

  @Field(() => Number, { description: 'Локальный ID записи лога в рамках расширения' })
  public readonly extension_local_id: number;

  @Field(() => String, { description: 'Имя расширения' })
  public readonly name: string;

  @Field(() => String, { description: 'Данные лога в формате JSON', nullable: true })
  public readonly data: string | null;

  @Field(() => Date, { description: 'Дата создания записи' })
  public readonly created_at: Date;

  @Field(() => Date, { description: 'Дата последнего обновления записи' })
  public readonly updated_at: Date;

  constructor(entity: LogExtensionDomainEntity<TLog>) {
    this.id = entity.id; // Глобальный ID
    this.extension_local_id = entity.extension_local_id; // Локальный ID
    this.name = entity.name;
    this.data = entity.data ? JSON.stringify(entity.data) : null;
    this.created_at = entity.created_at;
    this.updated_at = entity.updated_at;
  }
}
