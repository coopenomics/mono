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
      'Идентификатор пакета @scope/name; версия уже должна быть залита npm publish в реестр каталога',
  })
  packageId!: string;

  @Field({ description: 'Версия релиза в формате semver, например 1.0.0' })
  version!: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description:
      'Устарело (487-27): манифест читается из npm-packument опубликованной ' +
      'версии; поле игнорируется и оставлено для совместимости клиентов.',
  })
  manifest?: Record<string, unknown>;

  @Field({
    nullable: true,
    description: 'Устарело (487-27): игнорируется.',
  })
  tarballSha256?: string;

  @Field({
    nullable: true,
    description: 'Кратко, что изменилось — попадёт в заявку на модерацию',
  })
  brief?: string;
}
