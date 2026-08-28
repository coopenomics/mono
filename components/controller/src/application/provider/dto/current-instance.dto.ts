import { Field, ObjectType } from '@nestjs/graphql';
import { InstanceStatus } from '../../../domain/instance-status.enum';

@ObjectType()
export class CurrentInstanceDTO {
  @Field(() => InstanceStatus, { description: 'Статус инстанса' })
  status!: InstanceStatus;

  @Field({ description: 'Домен валиден' })
  is_valid!: boolean;

  @Field({ description: 'Домен делегирован и проверка здоровья пройдена' })
  is_delegated!: boolean;

  @Field({ description: 'Статус в блокчейне от контракта кооператива' })
  blockchain_status!: string;

  @Field({ description: 'Процент прогресса установки (0-100)' })
  progress!: number;

  @Field({ description: 'Домен инстанса' })
  domain!: string;

  @Field({ description: 'Название инстанса' })
  title!: string;

  @Field({ description: 'Описание инстанса' })
  description!: string;

  @Field({ description: 'URL изображения инстанса' })
  image!: string;

  @Field({
    description:
      'Обслуживание приостановлено: на домене кооператива стоит заглушка «временно недоступен»',
  })
  maintenance_mode!: boolean;

  @Field({
    description:
      'Идёт не первичная установка, а возврат в строй: после развёртывания провайдер вернёт данные из резервной копии',
  })
  is_restoring!: boolean;

  @Field({
    description: 'Сервер кооператива освобождён: аренда отменена, данные лежат в резервной копии',
  })
  is_released!: boolean;
}
