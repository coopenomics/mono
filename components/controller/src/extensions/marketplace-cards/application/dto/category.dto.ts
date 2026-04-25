import { ObjectType, Field, InputType, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';

@InputType('CreateCategoryInput')
export class CreateCategoryInputDTO {
  @Field(() => String)
  @IsString()
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  parent_id?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  icon?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  sort_order?: number;
}

@ObjectType('Category')
export class CategoryDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => String, { nullable: true })
  parent_id?: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  icon?: string;

  @Field(() => Int)
  sort_order!: number;

  @Field(() => Boolean)
  is_active!: boolean;
}
