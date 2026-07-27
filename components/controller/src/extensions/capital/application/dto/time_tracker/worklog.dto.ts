import { InputType, Field, Float, ObjectType, Int } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

@InputType('CapitalAddWorklogInput', {
  description: 'Ручная запись фактического времени по задаче',
})
export class CapitalAddWorklogInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя-исполнителя' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Хеш задачи' })
  @IsString()
  issue_hash!: string;

  @Field(() => Float, { description: 'Количество часов (> 0)' })
  @IsNumber()
  @Min(0.01)
  hours!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Дата работы YYYY-MM-DD (по умолчанию сегодня)',
  })
  @IsOptional()
  @IsString()
  date?: string;
}

@InputType('CapitalStartTimerInput', {
  description: 'Старт таймера на одной задаче',
})
export class CapitalStartTimerInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Хеш задачи' })
  @IsString()
  issue_hash!: string;
}

@InputType('CapitalStopTimerInput', {
  description: 'Остановка открытого таймера участника',
})
export class CapitalStopTimerInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsString()
  username!: string;
}

@InputType('CapitalPauseTimerInput', {
  description: 'Пауза открытого таймера (задача остаётся привязанной)',
})
export class CapitalPauseTimerInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsString()
  username!: string;
}

@InputType('CapitalResumeTimerInput', {
  description: 'Снятие паузы — продолжение учёта на той же задаче',
})
export class CapitalResumeTimerInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsString()
  username!: string;
}

@InputType('CapitalGetOpenTimerInput', {
  description: 'Запрос открытой сессии таймера участника',
})
export class CapitalGetOpenTimerInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsString()
  username!: string;
}

@ObjectType('CapitalTimerSession', {
  description: 'Сессия таймера учёта времени по задаче',
})
export class CapitalTimerSessionOutputDTO {
  @Field(() => String, { description: 'Идентификатор сессии' })
  _id!: string;

  @Field(() => String, { description: 'Хеш участника' })
  contributor_hash!: string;

  @Field(() => String, { description: 'Хеш задачи' })
  issue_hash!: string;

  @Field(() => String, { description: 'Хеш проекта' })
  project_hash!: string;

  @Field(() => String, { description: 'Имя кооператива' })
  coopname!: string;

  @Field(() => Date, { description: 'Время старта' })
  started_at!: Date;

  @Field(() => Date, { nullable: true, description: 'Время остановки (null если открыта)' })
  stopped_at?: Date | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Момент паузы (null если идёт или остановлена)',
  })
  paused_at?: Date | null;

  @Field(() => Float, { description: 'Сумма завершённых пауз в миллисекундах' })
  total_paused_ms!: number;

  @Field(() => Boolean, { description: 'Сессия на паузе' })
  is_paused!: boolean;

  @Field(() => Int, { description: 'Накопленные секунды без пауз на момент ответа' })
  elapsed_seconds!: number;

  @Field(() => String, { nullable: true, description: 'Название задачи' })
  issue_title?: string | null;
}
