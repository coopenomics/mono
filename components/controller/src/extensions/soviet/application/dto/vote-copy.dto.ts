import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray } from 'class-validator';

@InputType('CreateVoteCopyInput')
export class CreateVoteCopyInputDTO {
  @Field(() => String, { description: 'Чей голос копировать (член совета)' })
  @IsString()
  source_username!: string;

  @Field(() => [String], { nullable: true, description: 'Типы решений (пусто = все)' })
  @IsOptional()
  @IsArray()
  decision_types?: string[];
}

@ObjectType('VoteCopySetting')
export class VoteCopySettingDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => String)
  copier_username!: string;

  @Field(() => String)
  source_username!: string;

  @Field(() => [String])
  decision_types!: string[];

  @Field(() => Boolean)
  is_active!: boolean;

  @Field(() => String, { nullable: true })
  copyvote_public_key?: string;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}
