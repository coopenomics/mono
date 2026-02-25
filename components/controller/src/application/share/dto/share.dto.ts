import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray, IsInt, IsEnum } from 'class-validator';
import { ShareTargetType } from '~/infrastructure/share/share-token.entity';

registerEnumType(ShareTargetType, { name: 'ShareTargetType' });

@InputType('CreateShareLinkInput')
export class CreateShareLinkInputDTO {
  @Field(() => String)
  @IsString()
  pagePath!: string;

  @Field(() => String)
  @IsString()
  pageName!: string;

  @Field(() => ShareTargetType)
  @IsEnum(ShareTargetType)
  targetType!: ShareTargetType;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  targetUsername?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  linkName?: string;

  @Field(() => [String])
  @IsArray()
  allowedActions!: string[];

  @Field(() => Number, { nullable: true })
  @IsOptional()
  @IsInt()
  expiresInDays?: number;
}

@ObjectType('ShareLink')
export class ShareLinkDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  page_path!: string;

  @Field(() => String)
  page_name!: string;

  @Field(() => ShareTargetType)
  target_type!: ShareTargetType;

  @Field(() => String, { nullable: true })
  target_username?: string;

  @Field(() => String, { nullable: true })
  link_name?: string;

  @Field(() => [String])
  allowed_actions!: string[];

  @Field(() => String)
  token!: string;

  @Field(() => Boolean)
  is_active!: boolean;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date, { nullable: true })
  expires_at?: Date;
}
