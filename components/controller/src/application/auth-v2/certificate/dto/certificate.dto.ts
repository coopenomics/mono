import { Field, ObjectType } from '@nestjs/graphql';

/**
 * GraphQL-контракт удостоверения пайщика (participant_certificate, Story 1.8).
 * Выдаётся текущему авторизованному пайщику. Заменяет REST `coop/certificate` —
 * фронт получает сертификат через @coopenomics/sdk (Zeus), а не прямым REST.
 */
@ObjectType('ParticipantCertificate')
export class ParticipantCertificateDTO {
  @Field(() => String, { description: 'Подписанное удостоверение пайщика (JWT-сертификат CoopID)' })
  participant_certificate!: string;
}
