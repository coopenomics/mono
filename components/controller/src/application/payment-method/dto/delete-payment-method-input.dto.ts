import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('DeletePaymentMethodInput')
export class DeletePaymentMethodDTO {
  @Field(() => String, { description: 'Имя пользователя, чей метод оплаты нужно удалить' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Идентификатор метода оплаты' })
  // Идентификатор способа оплаты — строка (uuid, его выдаёт addPaymentMethod).
  // До 25.09.2026 здесь стояло @IsNumber, и удалить реквизиты было нельзя вовсе.
  @IsNotEmpty()
  @IsString()
  method_id!: string;
}
