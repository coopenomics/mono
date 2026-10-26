import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsString, Matches } from 'class-validator';

const PACKAGE_ID_RE = /^@[a-z0-9-]+\/[a-z0-9-]+$/;

@InputType('SetCatalogAppEnabledInput')
export class SetCatalogAppEnabledInputDTO {
  @Field(() => String, { description: 'Пакет каталога, например @voskhod/demoapp' })
  @IsString()
  @Matches(PACKAGE_ID_RE)
  packageId!: string;

  @Field(() => Boolean, { description: 'true — включить на рабочем столе, false — выключить' })
  @IsBoolean()
  enabled!: boolean;
}

export enum UnsubscribePackageStatus {
  CANCELLED = 'cancelled',
  NOT_SUBSCRIBED = 'notSubscribed',
  UNAVAILABLE = 'unavailable',
  FAILED = 'failed',
}

registerEnumType(UnsubscribePackageStatus, {
  name: 'UnsubscribePackageStatus',
  description: 'Исход отмены подписки на приложение',
});

@ObjectType()
export class UnsubscribePackageResultDTO {
  @Field(() => UnsubscribePackageStatus, { description: 'Исход' })
  status!: UnsubscribePackageStatus;

  @Field(() => String, { nullable: true, description: 'Пакет каталога' })
  packageId?: string;

  @Field(() => String, { nullable: true, description: 'Причина отказа' })
  error?: string;
}
