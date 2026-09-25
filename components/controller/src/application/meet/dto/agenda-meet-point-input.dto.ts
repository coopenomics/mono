import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { SafeMarkup } from '@coopenomics/extension-kit';
import type { AgendaGeneralMeetPointInputDomainInterface } from '~/domain/meet/interfaces/agenda-meet-point-input-domain.interface';

@InputType('AgendaGeneralMeetPointInput', { description: 'Пункт повестки общего собрания (для ввода)' })
export class AgendaGeneralMeetPointInputDTO implements AgendaGeneralMeetPointInputDomainInterface {
  @Field(() => String, { description: 'Контекст или дополнительная информация по пункту повестки' })
  @IsString()
  @SafeMarkup()
  context!: string;

  @Field(() => String, { description: 'Заголовок пункта повестки' })
  @IsNotEmpty()
  @IsString()
  @SafeMarkup()
  title!: string;

  @Field(() => String, { description: 'Предлагаемое решение по пункту повестки' })
  @IsNotEmpty()
  @IsString()
  @SafeMarkup()
  decision!: string;

  constructor(data: AgendaGeneralMeetPointInputDomainInterface) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
