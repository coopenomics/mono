/**
 * Выходные типы GraphQL для подписанного документа: то, что расширение отдаёт
 * интерфейсу пайщика.
 *
 * Переехало из `~/application/document/dto` контроллера: `DocumentAggregate`
 * возвращают резолверы девятнадцати файлов расширений, а этого пути за
 * пределами монолита нет.
 *
 * **Сертификата подписанта здесь нет намеренно.** В цепи у подписи есть только
 * `signer` — учётное имя; сертификат это join «кто скрывается за этим именем»,
 * который ядро подмешивает для показа. Он приварен к подписи исторически, и
 * именно этот шов тянул сюда представление о субъектах кооператива
 * (`AccountType`, три DTO сертификатов, union) — сорок с лишним потребителей в
 * ядре и ни одного в расширениях. Поле добавляет ядро отдельным
 * `@ResolveField` на этом же типе, поэтому в схеме `SignatureInfo` остаётся
 * прежним, а каркас о сертификатах не знает.
 */
import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { IsString, ValidateNested } from 'class-validator';

/** Реквизиты одной подписи под документом. */
@ObjectType('SignatureInfo')
export class SignatureInfoDTO {
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
}

/**
 * Подписанный документ целиком.
 *
 * Конструктор переносит подписи как есть, не пересобирая их: поля совпадают по
 * именам, а всё, что ядро добавило сверх контракта (тот самый сертификат),
 * доезжает до его собственного резолвера нетронутым.
 */
@ObjectType('SignedDigitalDocument')
export class SignedDigitalDocumentDTO {
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
  public readonly signatures!: SignatureInfoDTO[];

  constructor(data: {
    version: string;
    hash: string;
    doc_hash: string;
    meta_hash: string;
    meta: any;
    signatures: readonly any[];
  }) {
    this.version = data.version;
    this.hash = data.hash;
    this.doc_hash = data.doc_hash;
    this.meta_hash = data.meta_hash;
    this.meta = data.meta;
    this.signatures = data.signatures as SignatureInfoDTO[];
  }
}
