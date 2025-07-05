import { Field, ObjectType } from '@nestjs/graphql';
import type { ExtendedSignedDocumentDomainInterface } from '~/domain/document/interfaces/extended-signed-document-domain.interface';
import type { SignatureInfoDomainInterface } from '~/domain/document/interfaces/extended-signed-document-domain.interface';
import { UserCertificateUnion } from '../unions/user-certificate.union';
import GraphQLJSON from 'graphql-type-json';
import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IndividualCertificateDTO } from '~/modules/common/dto/individual-certificate.dto';
import { EntrepreneurCertificateDTO } from '~/modules/common/dto/entrepreneur-certificate.dto';
import { OrganizationCertificateDTO } from '~/modules/common/dto/organization-certificate.dto';
import type { UserCertificateDomainInterface } from '~/domain/user-certificate/interfaces/user-certificate-domain.interface';

@ObjectType('SignatureInfo')
export class SignatureInfoDTO implements SignatureInfoDomainInterface {
  @Field(() => Number)
  public readonly id!: number;

  @Field(() => String)
  @IsString()
  public readonly signer!: string;

  @Field(() => String)
  @IsString()
  public readonly public_key!: string;

  @Field(() => String)
  @IsString()
  public readonly signature!: string;

  @Field(() => String)
  @IsString()
  public readonly signed_at!: string;

  @Field(() => String)
  @IsString()
  public readonly signed_hash!: string;

  @Field(() => GraphQLJSON)
  public readonly meta!: any;

  @Field(() => Boolean, { nullable: true })
  public readonly is_valid?: boolean;

  @Field(() => UserCertificateUnion, { nullable: true, description: 'Сертификат подписанта (сокращенная информация)' })
  public readonly signer_certificate?:
    | IndividualCertificateDTO
    | EntrepreneurCertificateDTO
    | OrganizationCertificateDTO
    | null;
}

@ObjectType('SignedDigitalDocument')
export class SignedDigitalDocumentDTO implements ExtendedSignedDocumentDomainInterface {
  @Field(() => String)
  @IsString()
  public readonly version!: string;

  @Field(() => String)
  @IsString()
  public readonly hash!: string;

  @Field(() => String)
  @IsString()
  public readonly doc_hash!: string;

  @Field(() => String)
  @IsString()
  public readonly meta_hash!: string;

  @Field(() => GraphQLJSON)
  public readonly meta!: any;

  @Field(() => [SignatureInfoDTO])
  @ValidateNested({ each: true })
  @Type(() => SignatureInfoDTO)
  public readonly signatures!: SignatureInfoDTO[];

  /**
   * Преобразует доменный сертификат пользователя в DTO
   */
  private static mapDomainCertificateToDTO(
    cert: UserCertificateDomainInterface | null | undefined
  ): IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null {
    if (!cert) return null;

    if ('inn' in cert && 'ogrn' in cert && 'short_name' in cert) {
      // Organization
      return new OrganizationCertificateDTO({
        type: cert.type,
        username: cert.username,
        short_name: cert.short_name,
        represented_by: cert.represented_by,
        inn: cert.inn,
        ogrn: cert.ogrn,
      });
    } else if ('inn' in cert && 'first_name' in cert && 'last_name' in cert) {
      // Entrepreneur
      return new EntrepreneurCertificateDTO({
        type: cert.type,
        username: cert.username,
        first_name: cert.first_name,
        last_name: cert.last_name,
        middle_name: cert.middle_name,
        inn: cert.inn,
      });
    } else if ('first_name' in cert && 'last_name' in cert) {
      // Individual
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

  /**
   * Преобразует доменную SignatureInfo в DTO
   */
  private static mapSignatureInfoToDTO(signatureInfo: SignatureInfoDomainInterface): SignatureInfoDTO {
    return {
      id: signatureInfo.id,
      signer: signatureInfo.signer,
      public_key: signatureInfo.public_key,
      signature: signatureInfo.signature,
      signed_at: signatureInfo.signed_at,
      signed_hash: signatureInfo.signed_hash,
      meta: signatureInfo.meta,
      is_valid: signatureInfo.is_valid,
      signer_certificate: this.mapDomainCertificateToDTO(signatureInfo.signer_certificate),
    };
  }

  constructor(data: ExtendedSignedDocumentDomainInterface) {
    this.version = data.version;
    this.hash = data.hash;
    this.doc_hash = data.doc_hash;
    this.meta_hash = data.meta_hash;
    this.meta = data.meta;
    this.signatures = data.signatures.map((sig) => SignedDigitalDocumentDTO.mapSignatureInfoToDTO(sig));
  }
}
