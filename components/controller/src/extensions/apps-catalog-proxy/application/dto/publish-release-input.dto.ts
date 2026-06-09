import { Field, InputType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * Входные данные `Mutation.publishRelease` (story 9.3.b-rel).
 *
 * Эта мутация регистрирует новый релиз ранее зарегистрированного
 * пакета (см. `publishPackage`/9.3.b-pub). Прокидывается на ca-admin
 * `POST /v1/admin/releases` (action `apps::setrelease` on-chain), который
 * сам подписывает от имени chairman'а кооператива-оператора.
 *
 * `manifest` под архитектуру E10 содержит ссылки на артефакты в Nexus:
 * `coopenomics.backend.image` — docker-image (для subgraph'а
 * расширения), `coopenomics.frontend.tarball` — npm tarball (для
 * desktop-bundle). Сам manifest валидируется Zod-схемой
 * `PackageManifestSchema` на стороне ca-admin (HTTP 422 → resolver
 * мапит в `failed`).
 */
@InputType()
export class PublishReleaseInputDTO {
  @Field({
    description:
      'Идентификатор пакета в формате @scope/name (должен быть уже зарегистрирован через publishPackage)',
  })
  packageId!: string;

  @Field({ description: 'Версия релиза в формате semver, например 1.0.0' })
  version!: string;

  @Field(() => GraphQLJSON, {
    description:
      'Package manifest (валидируется Zod-схемой на ca-admin). ' +
      'Содержит coopenomics.backend.image (docker) + coopenomics.frontend.tarball (npm), ' +
      'requires/provides, GraphQL-схему и pricing-параметры.',
  })
  manifest!: Record<string, unknown>;

  @Field({
    nullable: true,
    description:
      'sha256 npm tarball\'а (HEX). Если не передан — ca-admin использует sentinel zero-hash.',
  })
  tarballSha256?: string;
}
