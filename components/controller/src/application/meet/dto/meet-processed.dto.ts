import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MeetQuestionResultDTO } from './meet-question-result.dto';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { MeetProcessedDomainInterface } from '~/domain/meet/interfaces/meet-processed-domain.interface';
import { DocumentAggregateDomainInterface } from '~/domain/document/interfaces/document-domain-aggregate.interface';
import { UserCertificateUnion } from '~/application/document/unions/user-certificate.union';
import { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import { EntrepreneurCertificateDTO } from '~/application/common/dto/entrepreneur-certificate.dto';
import { OrganizationCertificateDTO } from '~/application/common/dto/organization-certificate.dto';
import { AccountType } from '~/application/account/enum/account-type.enum';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';
import { DocumentAggregateDTO, SignedDigitalDocumentDTO } from '@coopenomics/extension-kit';

@ObjectType('MeetProcessed', { description: 'Данные о собрании после обработки' })
export class MeetProcessedDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Хеш собрания' })
  hash!: string;

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

  @Field(() => [MeetQuestionResultDTO], { description: 'Результаты голосования по вопросам' })
  results!: MeetQuestionResultDTO[];

  @Field(() => Int, { description: 'Количество подписанных бюллетеней' })
  signed_ballots!: number;

  @Field(() => Int, { description: 'Процент кворума' })
  quorum_percent!: number;

  @Field(() => Boolean, { description: 'Пройден ли кворум' })
  quorum_passed!: boolean;

  @Field(() => SignedDigitalDocumentDTO, { description: 'Документ решения из блокчейна' })
  decision!: SignedDigitalDocumentDTO;

  @Field(() => DocumentAggregateDTO, { nullable: true, description: 'Агрегат документа решения' })
  @ValidateNested()
  @Type(() => DocumentAggregateDTO)
  decisionAggregate!: DocumentAggregateDTO | null;

  constructor(
    data: MeetProcessedDomainInterface,
    decisionAggregate?: DocumentAggregateDomainInterface | null,
    presiderCertificate?: UserCertificateDomainInterface | null,
    secretaryCertificate?: UserCertificateDomainInterface | null
  ) {
    // Вспомогательная функция для создания сертификата DTO
    const createCertificateDTO = (
      certificate: UserCertificateDomainInterface | null
    ): IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null => {
      if (!certificate) return null;

      switch (certificate.type) {
        case AccountType.individual:
          return new IndividualCertificateDTO(certificate);
        case AccountType.entrepreneur:
          return new EntrepreneurCertificateDTO(certificate);
        case AccountType.organization:
          return new OrganizationCertificateDTO(certificate);
        default:
          return null;
      }
    };

    Object.assign(this, {
      ...data,
      results: data.results.map((result) => new MeetQuestionResultDTO(result)),
      decisionAggregate: decisionAggregate || null,
      presider_certificate: createCertificateDTO(presiderCertificate || null),
      secretary_certificate: createCertificateDTO(secretaryCertificate || null),
    });
  }
}
