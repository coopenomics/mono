import { ObjectType, Field, InputType, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt, IsArray } from 'class-validator';

@InputType('CreateApiKeyInput')
export class CreateApiKeyInputDTO {
  @Field(() => String)
  @IsString()
  name!: string;

  @Field(() => [String], { nullable: true, defaultValue: ['*'] })
  @IsOptional()
  @IsArray()
  allowedOperations?: string[];

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  expiresInDays?: number;
}

@ObjectType('ApiKeyCreated')
export class ApiKeyCreatedDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { description: 'Полный ключ — показывается ТОЛЬКО при создании' })
  key!: string;

  @Field(() => String)
  key_prefix!: string;

  @Field(() => [String])
  allowed_operations!: string[];

  @Field(() => Date, { nullable: true })
  expires_at?: Date;

  @Field(() => Date)
  created_at!: Date;
}

@ObjectType('ApiKeyInfo')
export class ApiKeyInfoDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  key_prefix!: string;

  @Field(() => String)
  created_by!: string;

  @Field(() => [String])
  allowed_operations!: string[];

  @Field(() => Boolean)
  is_active!: boolean;

  @Field(() => Date, { nullable: true })
  expires_at?: Date;

  @Field(() => Date, { nullable: true })
  last_used_at?: Date;

  @Field(() => Date)
  created_at!: Date;
}
