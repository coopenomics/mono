import { Field, InputType } from '@nestjs/graphql';

/**
 * Входные данные `Mutation.publishPackage` (story 9.3.b-pub).
 *
 * Эта мутация — первичная регистрация пакета в каталоге восхода. Она
 * прокидывается на ca-admin `POST /v1/admin/package` (action
 * `apps::regpkg` на blockchain), а ca-admin сам подписывает on-chain от
 * имени chairman'а кооператива-оператора (voskhod). Поэтому здесь нет
 * никаких ключей пайщика — только координаты пакета.
 *
 * Multipart upload install.js под Federation v2 более НЕ нужен:
 * расширение публикуется как npm-package + docker-image в Nexus, а
 * developer пушит их отдельной процедурой (`npm publish` + `docker
 * push`) через CA-auth scoped JWT. Story 9.3.b-pub оставляет только
 * on-chain регистрацию; релизы с manifest'ом — story 9.3.b-rel.
 */
@InputType()
export class PublishPackageInputDTO {
  @Field({
    description:
      'Идентификатор пакета в формате @scope/name, например @voskhod/demoapp',
  })
  packageId!: string;

  @Field({
    description:
      'Antelope-имя владельца пакета (1..12 символов из [a-z1-5.])',
  })
  ownerUsername!: string;

  @Field(() => [String], {
    description:
      'chain_id совместимых подсетей (каждый — 64 hex-символа), хотя бы одна',
  })
  compatibleSubnets!: string[];
}
