import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { SignatureInfoDTO } from '@coopenomics/extension-kit';
import { UserCertificateUnion } from '../unions/user-certificate.union';
import { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import { EntrepreneurCertificateDTO } from '~/application/common/dto/entrepreneur-certificate.dto';
import { OrganizationCertificateDTO } from '~/application/common/dto/organization-certificate.dto';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';

type CertificateDTO = IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO;

/**
 * Сертификат подписанта — кто скрывается за учётным именем в подписи.
 *
 * Живёт отдельным резолвером, а не полем DTO, потому что сам тип подписи уехал
 * в каркас расширений, а представление о субъектах кооператива — `AccountType`,
 * три вида сертификатов, union — осталось в ядре, где у него сорок с лишним
 * потребителей и ни одного в расширениях.
 *
 * В схеме `SignatureInfo.signer_certificate` от этого не меняется. Данные уже
 * лежат на объекте подписи: их кладёт `DocumentAggregationService`, а каркас
 * переносит подписи не пересобирая. Резолвер только приводит доменный
 * сертификат к нужному члену union — и делает это лениво, когда поле
 * действительно запросили.
 */
@Resolver(() => SignatureInfoDTO)
export class SignerCertificateResolver {
  @ResolveField(() => UserCertificateUnion, {
    nullable: true,
    description: 'Сертификат подписанта (сокращенная информация)',
  })
  signer_certificate(@Parent() signature: SignatureInfoDTO): CertificateDTO | null {
    const cert = (signature as { signer_certificate?: UserCertificateDomainInterface | null })?.signer_certificate;
    return SignerCertificateResolver.toDTO(cert);
  }

  /**
   * Вид сертификата определяется по составу полей, а не по `type`: доменный
   * объект собирается из разных источников, и `type` там не всегда заполнен.
   */
  private static toDTO(cert: UserCertificateDomainInterface | null | undefined): CertificateDTO | null {
    if (!cert) return null;

    if ('inn' in cert && 'ogrn' in cert && 'short_name' in cert) {
      return new OrganizationCertificateDTO({
        type: cert.type,
        username: cert.username,
        short_name: cert.short_name,
        represented_by: cert.represented_by,
        inn: cert.inn,
        ogrn: cert.ogrn,
      });
    }

    if ('inn' in cert && 'first_name' in cert && 'last_name' in cert) {
      return new EntrepreneurCertificateDTO({
        type: cert.type,
        username: cert.username,
        first_name: cert.first_name,
        last_name: cert.last_name,
        middle_name: cert.middle_name,
        inn: cert.inn,
      });
    }

    if ('first_name' in cert && 'last_name' in cert) {
      return new IndividualCertificateDTO({
        type: cert.type,
        username: cert.username,
        first_name: cert.first_name,
        last_name: cert.last_name,
        middle_name: cert.middle_name,
      });
    }

    return null;
  }
}
