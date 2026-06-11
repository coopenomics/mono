import { MetadataScanner, Reflector } from '@nestjs/core';
import { PolicyRegistry } from './policy.registry';
import { PolicyHandler } from './policy-handler.decorator';
import type { IPolicyHandler, PolicyEvaluationContext } from './policy.types';

@PolicyHandler('p-allow')
class AllowPolicy implements IPolicyHandler {
  readonly name = 'p-allow';
  evaluate(): boolean {
    return true;
  }
}

@PolicyHandler('p-deny')
class DenyPolicy implements IPolicyHandler {
  readonly name = 'p-deny';
  async evaluate(ctx: PolicyEvaluationContext): Promise<boolean> {
    return ctx.user.username === 'admin';
  }
}

/** Фейк DiscoveryService: отдаёт заранее заданный набор провайдер-обёрток. */
function fakeDiscovery(instances: Array<unknown>): { getProviders: () => Array<{ instance: unknown }> } {
  return { getProviders: () => instances.map((instance) => ({ instance })) };
}

function buildRegistry(instances: Array<unknown>): PolicyRegistry {
  const registry = new PolicyRegistry(
    fakeDiscovery(instances) as never,
    new MetadataScanner(),
    new Reflector(),
  );
  registry.onModuleInit();
  return registry;
}

const ctx = (username: string): PolicyEvaluationContext => ({
  user: { username, role: 'user' },
  action: 'vote',
  subject: 'CriticalAction',
});

describe('PolicyRegistry — Layer 3 (Story 6.3)', () => {
  it('индексирует @PolicyHandler-провайдеры и игнорирует посторонние', () => {
    const registry = buildRegistry([new AllowPolicy(), new DenyPolicy(), {}, undefined, { evaluate: () => true }]);
    expect(registry.has('p-allow')).toBe(true);
    expect(registry.has('p-deny')).toBe(true);
    expect(registry.has('p-unknown')).toBe(false);
  });

  it('evaluate исполняет политику по имени (sync и async)', async () => {
    const registry = buildRegistry([new AllowPolicy(), new DenyPolicy()]);
    expect(await registry.evaluate('p-allow', ctx('eve'))).toBe(true);
    expect(await registry.evaluate('p-deny', ctx('eve'))).toBe(false);
    expect(await registry.evaluate('p-deny', ctx('admin'))).toBe(true);
  });

  it('fail-closed: get/evaluate неизвестной политики бросает', () => {
    const registry = buildRegistry([new AllowPolicy()]);
    expect(() => registry.get('p-missing')).toThrow(/не зарегистрирована/);
    expect(() => registry.evaluate('p-missing', ctx('eve'))).toThrow(/не зарегистрирована/);
  });

  it('дубль имени политики бросает на старте', () => {
    expect(() => buildRegistry([new AllowPolicy(), new AllowPolicy()])).toThrow(/дважды/i);
  });
});
