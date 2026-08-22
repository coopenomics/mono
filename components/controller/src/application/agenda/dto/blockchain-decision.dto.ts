import { ObjectType, Field } from '@nestjs/graphql';
import type { SovietContract } from 'cooptypes';
import { SignedBlockchainDocumentDTO } from '~/application/document/dto/signed-blockchain-document.dto';
import { UserCertificateUnion } from '~/application/document/unions/user-certificate.union';
import { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import { EntrepreneurCertificateDTO } from '~/application/common/dto/entrepreneur-certificate.dto';
import { OrganizationCertificateDTO } from '~/application/common/dto/organization-certificate.dto';
import { AccountType } from '~/application/account/enum/account-type.enum';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';

@ObjectType('BlockchainDecision', {
  description: 'Запись в таблице блокчейна о процессе принятия решения советом кооператива',
})
export class BlockchainDecisionDTO implements SovietContract.Tables.Decisions.IDecision {
  @Field(() => Number)
  id!: number | string;

  @Field()
  coopname!: string;

  @Field()
  username!: string;

  @Field(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат пользователя, создавшего решение',
  })
  username_certificate?: IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null;

  @Field()
  type!: string;

  @Field(() => Number)
  batch_id!: number | string;

  @Field(() => SignedBlockchainDocumentDTO)
  statement!: SignedBlockchainDocumentDTO;

  @Field(() => [String])
  votes_for!: string[];

  @Field(() => [UserCertificateUnion], {
    description: 'Сертификаты пользователей, голосовавших "за"',
  })
  votes_for_certificates!: (IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO)[];

  @Field(() => [String])
  votes_against!: string[];

  @Field(() => [UserCertificateUnion], {
    description: 'Сертификаты пользователей, голосовавших "против"',
  })
  votes_against_certificates!: (IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO)[];

  @Field()
  validated!: boolean;

  @Field()
  approved!: boolean;

  @Field()
  authorized!: boolean;

  @Field()
  authorized_by!: string;

  @Field(() => SignedBlockchainDocumentDTO)
  authorization!: SignedBlockchainDocumentDTO;

  @Field()
  created_at!: string;

  @Field()
  expired_at!: string;

  @Field()
  meta!: string;

  @Field(() => String, { nullable: true })
  callback_contract!: string;

  @Field(() => String, { nullable: true })
  confirm_callback!: string;

  @Field(() => String, { nullable: true })
  decline_callback!: string;

  @Field(() => String, { nullable: true })
  hash!: string;

  @Field(() => Number, {
    description:
      'Текущее число членов совета (всего, как считает контракт). Нужно фронту для вычисления порога принятия/отклонения: за/против * 100 > council_members_count * 50',
  })
  council_members_count!: number;

  constructor(
    data?: any,
    usernameCertificate?: UserCertificateDomainInterface | null,
    votesForCertificates?: UserCertificateDomainInterface[],
    votesAgainstCertificates?: UserCertificateDomainInterface[],
    councilMembersCount = 0
  ) {
    if (data) {
      Object.assign(this, data);
    }

    this.council_members_count = councilMembersCount;

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

    // Устанавливаем сертификат пользователя
    this.username_certificate = createCertificateDTO(usernameCertificate || null);

    // Устанавливаем сертификаты голосовавших "за"
    this.votes_for_certificates = (votesForCertificates || [])
      .map((cert) => createCertificateDTO(cert))
      .filter((cert) => cert !== null) as (
      | IndividualCertificateDTO
      | EntrepreneurCertificateDTO
      | OrganizationCertificateDTO
    )[];

    // Устанавливаем сертификаты голосовавших "против"
    this.votes_against_certificates = (votesAgainstCertificates || [])
      .map((cert) => createCertificateDTO(cert))
      .filter((cert) => cert !== null) as (
      | IndividualCertificateDTO
      | EntrepreneurCertificateDTO
      | OrganizationCertificateDTO
    )[];
  }
}
