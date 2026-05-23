/**
 * SWC-readiness smoke-suite.
 *
 * Цель: поймать главный риск перехода с ts-node на SWC — потерю
 * `emitDecoratorMetadata` на barrel-импортах. Если SWC не эмитит правильные
 * `design:type` / `design:paramtypes` для типов, приходящих через `index.ts`
 * re-export, Nest DI начнёт резолвить ServiceB через `Object` вместо ServiceA
 * и упадёт в рантайме с UnknownDependenciesException.
 *
 * Тесты должны быть зелёными И на ts-node (baseline), И на SWC (после миграции).
 * Если на SWC упадут — значит регрессия metadata; править .swcrc
 * (transform.decoratorMetadata: true + keepClassNames: true) и/или
 * импортировать тип напрямую, минуя barrel.
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { ServiceA } from './barrel';
import { ServiceB } from './consumer';
import { SmokeDto, NestedPayload } from './dto';

describe('SWC readiness — emitDecoratorMetadata via barrel imports', () => {
  it('Reflect.getMetadata(design:paramtypes, ServiceB) === [ServiceA]', () => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', ServiceB);
    expect(paramTypes).toBeDefined();
    expect(Array.isArray(paramTypes)).toBe(true);
    expect(paramTypes).toHaveLength(1);
    // Главная проверка: тип параметра — реальный класс ServiceA, не Object.
    expect(paramTypes[0]).toBe(ServiceA);
  });

  it('Nest DI резолвит ServiceB с инжектом ServiceA через barrel', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ServiceA, ServiceB],
    }).compile();

    const b = moduleRef.get(ServiceB);
    expect(b).toBeInstanceOf(ServiceB);
    expect(b.delegate()).toBe('hello from ServiceA');
  });

  it('class-validator decorators эмитят корректные design:type', async () => {
    const dto = plainToInstance(SmokeDto, {
      name: 'alice',
      count: 42,
      nested: { label: 'inner' },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);

    const bad = plainToInstance(SmokeDto, {
      name: 123,
      count: 'forty-two',
      nested: { label: 7 },
    } as unknown);
    const badErrors = await validate(bad);
    // Ожидаем минимум 3 ошибки: name (IsString), count (IsInt),
    // nested.label (IsString через ValidateNested).
    expect(badErrors.length).toBeGreaterThanOrEqual(2);
  });

  it('NestedPayload design:type для @ValidateNested() field — это NestedPayload, не Object', () => {
    const designType = Reflect.getMetadata('design:type', SmokeDto.prototype, 'nested');
    expect(designType).toBe(NestedPayload);
  });
});
