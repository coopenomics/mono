import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';
import {
  KuPowerOfAttorneyStatus,
  KuPowerOfAttorneyType,
  KuTrusteeLiabilityStatus,
} from '../../domain/enums/ku-power-of-attorney.enum';

@ObjectType('KuPowerOfAttorney', { description: 'Доверенность кооператива' })
export class KuPowerOfAttorneyDTO {
  @Field(() => Int, { description: 'Номер доверенности — сквозной в кооперативе' })
  number!: number;

  @Field(() => KuPowerOfAttorneyType, { description: 'Тип доверенности' })
  type!: KuPowerOfAttorneyType;

  @Field(() => String, { description: 'Доверенное лицо — имя аккаунта' })
  holder!: string;

  @Field(() => String, { description: 'Доверенное лицо — ФИО' })
  holder_name!: string;

  @Field(() => String, { description: 'Кооперативный участок' })
  braname!: string;

  @Field(() => String, { description: 'Номер протокола совета — основание доверенности' })
  protocol_number!: string;

  @Field(() => String, { description: 'Дата протокола совета, ДД.ММ.ГГГГ' })
  protocol_date!: string;

  @Field(() => String, { description: 'Дата выдачи, ГГГГ-ММ-ДД' })
  issued_at!: string;

  @Field(() => String, { description: 'Последний день срока, ГГГГ-ММ-ДД' })
  valid_until!: string;

  @Field(() => KuPowerOfAttorneyStatus, { description: 'Состояние на сегодня' })
  status!: KuPowerOfAttorneyStatus;

  @Field(() => Boolean, { description: 'До конца срока тридцать дней или меньше — пора подписать новую' })
  renewal_due!: boolean;

  @Field(() => Date, { description: 'Когда доверенное лицо подписало доверенность' })
  signed_at!: Date;

  @Field(() => Date, { nullable: true, description: 'Когда поставлена встречная подпись или получен отказ' })
  resolved_at?: Date | null;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Документ доверенности с подписями' })
  document?: DocumentAggregateDTO | null;
}

@InputType('KuPowerOfAttorneyFilterInput', { description: 'Отбор реестра доверенностей' })
export class KuPowerOfAttorneyFilterInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { nullable: true, description: 'Кооперативный участок' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => String, { nullable: true, description: 'Доверенное лицо — имя аккаунта' })
  @IsOptional()
  @IsString()
  holder?: string;

  @Field(() => KuPowerOfAttorneyType, { nullable: true, description: 'Тип доверенности' })
  @IsOptional()
  @IsEnum(KuPowerOfAttorneyType)
  type?: KuPowerOfAttorneyType;
}

@InputType('KuTrusteeDocumentsInput', { description: 'Документы председателя кооперативного участка' })
export class KuTrusteeDocumentsInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Кооперативный участок' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Председатель участка' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}

@ObjectType('KuTrusteeDocuments', {
  description: 'Доверенность и договор о полной материальной ответственности председателя кооперативного участка',
})
export class KuTrusteeDocumentsDTO {
  @Field(() => String, { description: 'Кооперативный участок' })
  braname!: string;

  @Field(() => KuPowerOfAttorneyDTO, { nullable: true, description: 'Последняя доверенность председателя участка' })
  authority?: KuPowerOfAttorneyDTO | null;

  @Field(() => KuPowerOfAttorneyDTO, {
    nullable: true,
    description: 'Действующая доверенность, пока новая ждёт встречной подписи',
  })
  active_authority?: KuPowerOfAttorneyDTO | null;

  @Field(() => Boolean, {
    description: 'Председатель участка может подписать доверенность: её нет, срок истекает или истёк, прежняя отклонена',
  })
  can_sign_authority!: boolean;

  @Field(() => KuTrusteeLiabilityStatus, { description: 'Договор о полной материальной ответственности' })
  liability_status!: KuTrusteeLiabilityStatus;

  @Field(() => Boolean, { description: 'Решение совета об учреждении участка найдено — доверенность можно выдать' })
  has_protocol!: boolean;
}
