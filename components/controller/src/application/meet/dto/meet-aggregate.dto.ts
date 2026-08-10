import { Field, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { MeetPreProcessingDTO } from './meet-pre.dto';
import { MeetProcessingDTO } from './meet-processing.dto';
import { MeetProcessedDTO } from './meet-processed.dto';
import { MeetAggregate } from '~/domain/meet/aggregates/meet-domain.aggregate';
import { DocumentAggregateDomainInterface } from '~/domain/document/interfaces/document-domain-aggregate.interface';
import { DocumentDomainAggregate } from '~/domain/document/aggregates/document-domain.aggregate';
import { MeetDTO } from './meet.dto';
import { QuestionDTO } from './question.dto';
import { ExtendedMeetStatus } from '~/domain/meet/enums/extended-meet-status.enum';
import { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import { EntrepreneurCertificateDTO } from '~/application/common/dto/entrepreneur-certificate.dto';
import { OrganizationCertificateDTO } from '~/application/common/dto/organization-certificate.dto';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

@ObjectType('MeetAggregate', { description: 'Агрегат данных о собрании, содержащий информацию о разных этапах' })
export class MeetAggregateDTO {
  @Field(() => String, { description: 'Хеш собрания' })
  @IsNotEmpty()
  @IsString()
  hash!: string;

  @Field(() => MeetPreProcessingDTO, { nullable: true, description: 'Данные собрания на этапе предварительной обработки' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MeetPreProcessingDTO)
  pre?: MeetPreProcessingDTO | null;

  @Field(() => MeetProcessingDTO, { nullable: true, description: 'Данные собрания на этапе обработки' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MeetProcessingDTO)
  processing?: MeetProcessingDTO | null;

  @Field(() => MeetProcessedDTO, { nullable: true, description: 'Данные собрания после обработки' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MeetProcessedDTO)
  processed?: MeetProcessedDTO | null;

  constructor(
    data: MeetAggregate,
    decisionAggregate?: DocumentAggregateDomainInterface | null,
    processingDocuments?: {
      proposalAggregate?: DocumentDomainAggregate | null;
      authorizationAggregate?: DocumentDomainAggregate | null;
      decision1Aggregate?: DocumentDomainAggregate | null;
      decision2Aggregate?: DocumentDomainAggregate | null;
    },
    presiderCertificate?: UserCertificateDomainInterface | null,
    secretaryCertificate?: UserCertificateDomainInterface | null,
    initiatorCertificate?: UserCertificateDomainInterface | null,
    processedPresiderCertificate?: UserCertificateDomainInterface | null,
    processedSecretaryCertificate?: UserCertificateDomainInterface | null
  ) {
    this.hash = data.hash;
    this.pre = data.pre
      ? new MeetPreProcessingDTO(data.pre, presiderCertificate, secretaryCertificate, initiatorCertificate)
      : null;

    // Создаем processed с передачей decisionAggregate и сертификатов, если есть
    if (data.processed) {
      this.processed = new MeetProcessedDTO(
        data.processed,
        decisionAggregate,
        processedPresiderCertificate,
        processedSecretaryCertificate
      );
    } else {
      this.processed = null;
    }

    // Создаем processing DTO с обогащенными данными, если они предоставлены
    if (data.processing && processingDocuments) {
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

      // Создаем объект MeetDTO с документами
      const meetDTO = new MeetDTO({
        id: data.processing.meet.id,
        hash: data.processing.meet.hash,
        coopname: data.processing.meet.coopname,
        type: data.processing.meet.type,
        initiator: data.processing.meet.initiator,
        initiator_certificate: createCertificateDTO(initiatorCertificate || null),
        presider: data.processing.meet.presider,
        presider_certificate: createCertificateDTO(presiderCertificate || null),
        secretary: data.processing.meet.secretary,
        secretary_certificate: createCertificateDTO(secretaryCertificate || null),
        status: data.processing.meet.status,
        created_at: data.processing.meet.created_at,
        open_at: data.processing.meet.open_at,
        close_at: data.processing.meet.close_at,
        quorum_percent: data.processing.meet.quorum_percent,
        signed_ballots: data.processing.meet.signed_ballots,
        current_quorum_percent: data.processing.meet.current_quorum_percent,
        level: data.processing.meet.level,
        cycle: data.processing.meet.cycle,
        quorum_passed: data.processing.meet.quorum_passed,
        // Устанавливаем обогащенные документы или null/undefined
        proposal: processingDocuments.proposalAggregate
          ? new DocumentAggregateDTO(processingDocuments.proposalAggregate)
          : null,
        authorization: processingDocuments.authorizationAggregate
          ? new DocumentAggregateDTO(processingDocuments.authorizationAggregate)
          : undefined,
        decision1: processingDocuments.decision1Aggregate
          ? new DocumentAggregateDTO(processingDocuments.decision1Aggregate)
          : undefined,
        decision2: processingDocuments.decision2Aggregate
          ? new DocumentAggregateDTO(processingDocuments.decision2Aggregate)
          : undefined,
        notified_users: data.processing.meet.notified_users,
      });

      // Преобразуем вопросы в DTO
      const questionsDTO = data.processing.questions.map((q) => new QuestionDTO(q));

      // Создаем MeetProcessingDTO
      this.processing = new MeetProcessingDTO({
        hash: data.processing.hash,
        meet: meetDTO,
        questions: questionsDTO,
        isVoted: data.processing.isVoted,
        extendedStatus: data.processing.extendedStatus as ExtendedMeetStatus,
      });
    } else {
      this.processing = null;
    }
  }
}
