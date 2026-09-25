import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SafeMarkup } from '@coopenomics/extension-kit';

@InputType('AgendaGeneralMeetQuestion', { description: 'Вопрос повестки общего собрания' })
export class AgendaGeneralMeetQuestionDTO {
  @Field(() => String, { description: 'Номер вопроса в повестке' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @Field(() => String, { description: 'Заголовок вопроса повестки' })
  @IsString()
  @IsNotEmpty()
  @SafeMarkup()
  title!: string;

  @Field(() => String, { description: 'Предлагаемое решение по вопросу повестки' })
  @IsString()
  @IsNotEmpty()
  @SafeMarkup()
  decision!: string;

  @Field(() => String, { nullable: true, description: 'Контекст или дополнительная информация по вопросу' })
  @IsString()
  @IsOptional()
  @SafeMarkup()
  context?: string;
}
