import { IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceA } from './barrel';

export class NestedPayload {
  @IsString()
  label!: string;
}

export class SmokeDto {
  @IsString()
  name!: string;

  @IsInt()
  count!: number;

  @ValidateNested()
  @Type(() => NestedPayload)
  nested!: NestedPayload;

  // Поле, тип которого приходит через barrel-импорт. SWC исторически глючил
  // именно здесь — мог записать в `design:type` `Object` вместо `ServiceA`,
  // сломав class-validator и DI-резолв. Покрытие через ValidateNested выше
  // (NestedPayload) + ServiceB constructor через @Inject — те же кодпути.
  // Поле marker оставлено для документации, но без декоратора metadata
  // не эмитится в принципе (см. transpile-only-probe.ts).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly _markerCarryover?: ServiceA;
}
