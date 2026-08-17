import { ExtendedMeetStatus } from '~/domain/meet/enums/extended-meet-status.enum';
import { Field, ObjectType } from '@nestjs/graphql';
import { IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MeetDTO } from './meet.dto';
import { QuestionDTO } from './question.dto';

@ObjectType('MeetProcessing', { description: 'Данные о собрании в процессе обработки' })
export class MeetProcessingDTO {
  @Field(() => String, { description: 'Хеш собрания' })
  hash!: string;

  @Field(() => MeetDTO, { description: 'Основная информация о собрании' })
  @ValidateNested()
  @Type(() => MeetDTO)
  meet!: MeetDTO;

  @Field(() => [QuestionDTO], { description: 'Список вопросов повестки собрания' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDTO)
  questions!: QuestionDTO[];

  @Field(() => Boolean, { description: 'Флаг указывающий, голосовал ли текущий пользователь' })
  isVoted!: boolean;

  @Field(() => ExtendedMeetStatus, {
    description: 'Расширенный статус собрания на основе дат и состояния',
  })
  @IsEnum(ExtendedMeetStatus)
  extendedStatus!: ExtendedMeetStatus;

  constructor(data: MeetProcessingDTO) {
    Object.assign(this, data);
  }
}
