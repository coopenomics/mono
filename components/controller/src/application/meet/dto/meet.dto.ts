import { Field, Float, ObjectType } from '@nestjs/graphql';
import { ValidateNested } from 'class-validator';
import { UserCertificateUnion } from '~/application/document/unions/user-certificate.union';
import { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import { EntrepreneurCertificateDTO } from '~/application/common/dto/entrepreneur-certificate.dto';
import { OrganizationCertificateDTO } from '~/application/common/dto/organization-certificate.dto';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

@ObjectType('Meet', { description: 'Данные о собрании кооператива' })
export class MeetDTO {
  @Field(() => Number, { description: 'Уникальный идентификатор собрания' })
  id!: number;

  @Field(() => String, { description: 'Хеш собрания' })
  hash!: string;

  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Тип собрания' })
  type!: string;

  @Field(() => String, { description: 'Уровень собрания' })
  level!: string;

  @Field(() => String, { description: 'Инициатор собрания' })
  initiator!: string;

  @Field(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат инициатора собрания',
  })
  initiator_certificate?: IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null;

  @Field(() => String, { description: 'Председатель собрания' })
  presider!: string;

  @Field(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат председателя собрания',
  })
  presider_certificate?: IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null;

  @Field(() => String, { description: 'Секретарь собрания' })
  secretary!: string;

  @Field(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат секретаря собрания',
  })
  secretary_certificate?: IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null;

  @Field(() => String, { description: 'Статус собрания' })
  status!: string;

  @Field(() => Date, { description: 'Дата создания собрания' })
  created_at!: Date;

  @Field(() => Date, { description: 'Дата открытия собрания' })
  open_at!: Date;

  @Field(() => Date, { description: 'Дата закрытия собрания' })
  close_at!: Date;

  @Field(() => Float, { description: 'Процент необходимого кворума' })
  quorum_percent!: number;

  @Field(() => Number, { description: 'Количество подписанных бюллетеней' })
  signed_ballots!: number;

  @Field(() => Float, { description: 'Текущий процент кворума' })
  current_quorum_percent!: number;

  @Field(() => Number, { description: 'Цикл собрания' })
  cycle!: number;

  @Field(() => Boolean, { description: 'Флаг достижения кворума' })
  quorum_passed!: boolean;

  @Field(() => DocumentAggregateDTO, { description: 'Документ с повесткой собрания', nullable: true })
  @ValidateNested()
  proposal!: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, {
    description: 'Документ с решением совета о проведении собрания',
    nullable: true,
  })
  @ValidateNested()
  authorization?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    description: 'Документ с решением секретаря',
    nullable: true,
  })
  @ValidateNested()
  decision1?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    description: 'Документ с решением председателя',
    nullable: true,
  })
  @ValidateNested()
  decision2?: DocumentAggregateDTO;

  @Field(() => [String], {
    description: 'Список пользователей, которые подписали уведомление',
  })
  notified_users!: string[];

  constructor(data: MeetDTO) {
    Object.assign(this, data);
  }
}
