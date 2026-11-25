import { Field, ObjectType } from '@nestjs/graphql';
import { UserCertificateUnion } from '~/application/document/unions/user-certificate.union';
import type { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import type { EntrepreneurCertificateDTO } from '~/application/common/dto/entrepreneur-certificate.dto';
import type { OrganizationCertificateDTO } from '~/application/common/dto/organization-certificate.dto';

@ObjectType('MeetParticipation', {
  description: 'Право текущего пайщика на общем собрании: голос, подтверждение уведомления, представитель участка',
})
export class MeetParticipationDTO {
  @Field(() => Boolean, {
    description: 'Собрание проходит в форме собрания уполномоченных: голосуют председатели кооперативных участков',
  })
  isTrusteesMeet!: boolean;

  @Field(() => Boolean, { description: 'Пайщик вправе подать бюллетень на этом собрании' })
  canVote!: boolean;

  @Field(() => Boolean, { description: 'Пайщик вправе подтвердить получение уведомления о собрании' })
  canNotify!: boolean;

  @Field(() => Boolean, { description: 'Кооперативный участок пайщика уже подал голос на этом собрании' })
  branchVoted!: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Председатель кооперативного участка пайщика, голосующий за участок на собрании уполномоченных',
  })
  branchTrustee!: string | null;

  @Field(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат председателя кооперативного участка пайщика',
  })
  branchTrusteeCertificate!: IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null;

  constructor(data: MeetParticipationDTO) {
    this.isTrusteesMeet = data.isTrusteesMeet;
    this.canVote = data.canVote;
    this.canNotify = data.canNotify;
    this.branchVoted = data.branchVoted;
    this.branchTrustee = data.branchTrustee;
    this.branchTrusteeCertificate = data.branchTrusteeCertificate;
  }
}
