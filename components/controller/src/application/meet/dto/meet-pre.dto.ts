import { Field, ObjectType } from '@nestjs/graphql';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AgendaMeetPointDTO } from './agenda-meet-point.dto';
import type { MeetPreProcessingDomainInterface } from '~/domain/meet/interfaces/meet-pre-domain.interface';
import { UserCertificateUnion } from '~/application/document/unions/user-certificate.union';
import { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import { EntrepreneurCertificateDTO } from '~/application/common/dto/entrepreneur-certificate.dto';
import { OrganizationCertificateDTO } from '~/application/common/dto/organization-certificate.dto';
import { AccountType } from '~/application/account/enum/account-type.enum';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

@ObjectType('MeetPreProcessing', { description: 'Предварительные данные собрания перед обработкой' })
export class MeetPreProcessingDTO implements MeetPreProcessingDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Хеш собрания' })
  hash!: string;

  @Field(() => String, { description: 'Инициатор собрания' })
  initiator!: string;

  @Field(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат инициатора собрания',
  })
  initiator_certificate?: IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null;

  @Field(() => String, { description: 'Председатель собрания' })
  presider!: string;

  @Field(() => String, { description: 'Секретарь собрания' })
  secretary!: string;

  @Field(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат председателя собрания',
  })
  presider_certificate?: IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null;

  @Field(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат секретаря собрания',
  })
  secretary_certificate?: IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null;

  @Field(() => [AgendaMeetPointDTO], { description: 'Повестка собрания' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgendaMeetPointDTO)
  agenda!: AgendaMeetPointDTO[];

  @Field(() => Date, { description: 'Дата открытия собрания' })
  open_at!: Date;

  @Field(() => Date, { description: 'Дата закрытия собрания' })
  close_at!: Date;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Документ с предложением повестки собрания',
  })
  @IsOptional()
  proposal?: DocumentAggregateDTO;

  @Field(() => String, {
    nullable: true,
    description: 'Дополнительная информация о формате собрания',
  })
  @IsOptional()
  details?: string | null;

  constructor(
    data: MeetPreProcessingDomainInterface,
    presiderCertificate?: UserCertificateDomainInterface | null,
    secretaryCertificate?: UserCertificateDomainInterface | null,
    initiatorCertificate?: UserCertificateDomainInterface | null
  ) {
    this.coopname = data.coopname;
    this.hash = data.hash;
    this.initiator = data.initiator;
    this.presider = data.presider;
    this.secretary = data.secretary;
    this.agenda = data.agenda.map((point) => new AgendaMeetPointDTO(point));
    this.open_at = data.open_at;
    this.close_at = data.close_at;
    this.proposal = data.proposal ? new DocumentAggregateDTO(data.proposal) : undefined;
    this.details = data.details ?? null;

    // Обрабатываем сертификат инициатора
    if (initiatorCertificate) {
      switch (initiatorCertificate.type) {
        case AccountType.individual:
          this.initiator_certificate = new IndividualCertificateDTO(initiatorCertificate);
          break;
        case AccountType.entrepreneur:
          this.initiator_certificate = new EntrepreneurCertificateDTO(initiatorCertificate);
          break;
        case AccountType.organization:
          this.initiator_certificate = new OrganizationCertificateDTO(initiatorCertificate);
          break;
        default:
          this.initiator_certificate = null;
      }
    } else {
      this.initiator_certificate = null;
    }

    // Обрабатываем сертификат председателя
    if (presiderCertificate) {
      switch (presiderCertificate.type) {
        case AccountType.individual:
          this.presider_certificate = new IndividualCertificateDTO(presiderCertificate);
          break;
        case AccountType.entrepreneur:
          this.presider_certificate = new EntrepreneurCertificateDTO(presiderCertificate);
          break;
        case AccountType.organization:
          this.presider_certificate = new OrganizationCertificateDTO(presiderCertificate);
          break;
        default:
          this.presider_certificate = null;
      }
    } else {
      this.presider_certificate = null;
    }

    // Обрабатываем сертификат секретаря
    if (secretaryCertificate) {
      switch (secretaryCertificate.type) {
        case AccountType.individual:
          this.secretary_certificate = new IndividualCertificateDTO(secretaryCertificate);
          break;
        case AccountType.entrepreneur:
          this.secretary_certificate = new EntrepreneurCertificateDTO(secretaryCertificate);
          break;
        case AccountType.organization:
          this.secretary_certificate = new OrganizationCertificateDTO(secretaryCertificate);
          break;
        default:
          this.secretary_certificate = null;
      }
    } else {
      this.secretary_certificate = null;
    }
  }
}
