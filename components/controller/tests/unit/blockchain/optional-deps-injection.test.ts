/**
 * Необязательные зависимости «ответа по факту из цепи» внедряются по явному
 * токену класса.
 *
 * Тип параметра `X | null` метаданные TypeScript стирают до `Object`: Nest не
 * может его подставить, `@Optional()` молча отдаёт пусто, и срабатывает
 * значение по умолчанию. 23.09.2026 так оказались выключены ожидание разбора
 * блока в transact, быстрый путь afterTransact и лента изменений — без единой
 * ошибки на старте. Юнит-тесты собирают сервисы руками и этого не видят,
 * поэтому проверяем сами метаданные, по которым собирает Nest.
 */
import { OPTIONAL_DEPS_METADATA, SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { BlockchainConsumerService } from '~/infrastructure/blockchain/blockchain-consumer.service';
import { ChainDeltaWaiterService } from '~/infrastructure/blockchain/chain-delta-waiter.service';
import { ActionReleaseGate } from '~/infrastructure/blockchain/action-release-gate.service';
import { ChainChangesService } from '~/infrastructure/blockchain/chain-changes.service';

function injected(target: object, index: number): unknown {
  const deps = (Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) ?? []) as { index: number; param: unknown }[];
  return deps.find((d) => d.index === index)?.param;
}

function optional(target: object): number[] {
  return (Reflect.getMetadata(OPTIONAL_DEPS_METADATA, target) ?? []) as number[];
}

describe('необязательные зависимости ответа по факту — по явному токену', () => {
  it.each([
    ['BlockchainService → ActionReleaseGate', BlockchainService, 3, ActionReleaseGate],
    ['ChainDeltaWaiterService → ActionReleaseGate', ChainDeltaWaiterService, 0, ActionReleaseGate],
    ['BlockchainConsumerService → ChainChangesService', BlockchainConsumerService, 6, ChainChangesService],
  ])('%s', (_name, target, index, token) => {
    expect(injected(target, index)).toBe(token);
    expect(optional(target)).toContain(index);
  });
});
