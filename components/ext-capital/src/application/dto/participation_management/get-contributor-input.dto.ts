import { Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional, ValidateIf } from 'class-validator';

/**
 * DTO для получения участника
 */
@InputType('GetContributorInput')
export class GetContributorInputDTO {
  @Field(() => String, { nullable: true, description: 'ID участника' })
  @IsString()
  @IsOptional()
  _id?: string;

  @Field(() => String, { nullable: true, description: 'Имя пользователя' })
  @IsString()
  @IsOptional()
  username?: string;

  @Field(() => String, { nullable: true, description: 'Хеш участника' })
  @IsString()
  @IsOptional()
  contributor_hash?: string;

  /**
   * Валидация: хотя бы одно поле должно быть заполнено
   */
  @ValidateIf((o: GetContributorInputDTO) => !o._id && !o.username && !o.contributor_hash)
  validateAtLeastOneField(): boolean {
    throw new Error('Необходимо указать хотя бы одно из полей: _id, username или contributor_hash');
  }
}
