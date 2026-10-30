import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProgramPropertyStatus } from '../../../domain/enums/program-property-status.enum';

/** Отбор паевых взносов имуществом в «Благорост». */
@InputType('CapitalProgramPropertyFilter')
export class ProgramPropertyFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Имя пайщика' })
  @IsOptional()
  @IsString()
  username?: string;

  @Field(() => ProgramPropertyStatus, { nullable: true, description: 'Статус взноса' })
  @IsOptional()
  @IsEnum(ProgramPropertyStatus)
  status?: ProgramPropertyStatus;
}
