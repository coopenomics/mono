import { ObjectType, Field, Int } from '@nestjs/graphql';
import { RepresentedByDTO } from '~/application/common/dto/represented-by.dto';
import type { BranchDomainInterface } from '~/domain/branch/interfaces/branch-domain.interface';
import type { BranchDomainEntity } from '~/domain/branch/entities/branch-domain.entity';
import { OrganizationDetailsDTO } from '~/application/common/dto/organization-details.dto';
import { IndividualDTO } from '~/application/common/dto/individual.dto';
import { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { IsArray, IsJSON, IsString } from 'class-validator';
import { BankPaymentMethodDTO } from '~/application/payment-method/dto/bank-payment-method.dto';
import { AuthRoles, GqlJwtAuthGuard, RolesGuard } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
@ObjectType('Branch')
export class BranchDTO implements BranchDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  public readonly coopname: string;

  @Field(() => String, { description: 'Уникальное имя кооперативного участка' })
  @IsString()
  public readonly braname: string;

  @Field(() => IndividualDTO, { description: 'Председатель кооперативного участка' })
  @AuthRoles(['chairman', 'member'])
  @IsString()
  public readonly trustee: IndividualDTO;

  @Field(() => [IndividualDTO], { description: 'Доверенные аккаунты' })
  @AuthRoles(['chairman', 'member'])
  @IsArray()
  public readonly trusted: IndividualDTO[];

  // публичная часть (сертификаты — только ФИО и имя аккаунта) доступна любому
  // пайщику; полные персональные данные выше остаются под ограничением ролей
  @Field(() => IndividualCertificateDTO, { description: 'Сертификат председателя кооперативного участка (ФИО)' })
  public readonly trustee_certificate: IndividualCertificateDTO;

  @Field(() => [IndividualCertificateDTO], { description: 'Сертификаты доверенных лиц участка (ФИО)' })
  public readonly trusted_certificates: IndividualCertificateDTO[];

  @Field(() => String, { description: 'Тип организации' })
  @IsString()
  public readonly type: string;

  @Field(() => String, { description: 'Краткое название организации' })
  @IsString()
  public readonly short_name: string;

  @Field(() => String, { description: 'Полное название организации' })
  @IsString()
  public readonly full_name: string;

  @Field(() => RepresentedByDTO, { description: 'Представитель организации' })
  @IsJSON()
  public readonly represented_by: RepresentedByDTO;

  @Field(() => String, { description: 'Страна' })
  @IsString()
  public readonly country: string;

  @Field(() => String, { description: 'Город' })
  @IsString()
  public readonly city: string;

  @Field(() => String, { description: 'Полный адрес' })
  @IsString()
  public readonly full_address: string;

  @Field(() => String, { description: 'Фактический адрес' })
  @IsString()
  public readonly fact_address: string;

  @Field(() => String, { description: 'Телефон' })
  @IsString()
  public readonly phone: string;

  @Field(() => String, { description: 'Email' })
  @IsString()
  public readonly email: string;

  @Field(() => BankPaymentMethodDTO, { description: 'Банковский счёт' })
  @IsJSON()
  public readonly bank_account: BankPaymentMethodDTO;

  @Field(() => OrganizationDetailsDTO, { description: 'Детали организации' })
  @IsJSON()
  public readonly details: OrganizationDetailsDTO;

  @Field(() => Int, { description: 'Количество пайщиков, состоящих в кооперативном участке' })
  public readonly participants_count: number;

  @Field(() => Boolean, {
    description: 'Приватный кооперативный участок: выбрать его при вступлении или смене могут только пайщики из белого списка',
  })
  public readonly is_private: boolean;

  @Field(() => Boolean, {
    description: 'Доступен ли участок текущему пайщику для выбора (публичный участок либо пайщик в белом списке)',
  })
  public readonly is_available: boolean;

  // список ФИО пайщиков белого списка нужен председателю для управления приватным участком
  @Field(() => [IndividualCertificateDTO], { description: 'Пайщики в белом списке приватного участка (ФИО)' })
  @AuthRoles(['chairman', 'member'])
  public readonly whitelist_certificates: IndividualCertificateDTO[];

  constructor(entity: BranchDomainEntity) {
    this.coopname = entity.coopname;
    this.braname = entity.braname;
    this.trustee = new IndividualDTO(entity.trustee);
    this.trusted = entity.trusted.map((trustedEntity) => new IndividualDTO(trustedEntity));
    this.trustee_certificate = new IndividualCertificateDTO({ ...entity.trustee, type: AccountType.individual });
    this.trusted_certificates = entity.trusted.map(
      (trustedEntity) => new IndividualCertificateDTO({ ...trustedEntity, type: AccountType.individual }),
    );
    this.type = entity.type;
    this.short_name = entity.short_name;
    this.full_name = entity.full_name;
    this.represented_by = new RepresentedByDTO(entity.represented_by);
    this.country = entity.country;
    this.city = entity.city;
    this.full_address = entity.full_address;
    this.fact_address = entity.fact_address;
    this.phone = entity.phone;
    this.email = entity.email;
    this.details = new OrganizationDetailsDTO(entity.details);
    this.bank_account = new BankPaymentMethodDTO(entity.bank_account);
    this.participants_count = entity.participants_count;
    this.is_private = entity.is_private;
    this.is_available = entity.is_available;
    this.whitelist_certificates = entity.whitelist_members.map(
      (member) => new IndividualCertificateDTO({ ...member, type: AccountType.individual }),
    );
  }
}
