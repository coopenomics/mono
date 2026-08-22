import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { POLICY_HANDLER_NAME } from './policy-handler.decorator';
import type { IPolicyHandler, PolicyEvaluationContext } from './policy.types';

/**
 * Реестр политик Layer 3 (Story 6.3). На старте обходит DI-контейнер, находит все
 * провайдеры, помеченные `@PolicyHandler(name)`, и индексирует по имени. Guard
 * (Story 6.4) для endpoint с `@CheckAbility(..., { policy })` берёт политику по имени
 * и исполняет `evaluate(context)`.
 *
 * Fail-closed: запрос неизвестной политики бросает — лучше упасть, чем молча пропустить
 * требование авторизации (опечатка в имени политики не должна открывать доступ).
 */
@Injectable()
export class PolicyRegistry implements OnModuleInit {
  private readonly logger = new Logger(PolicyRegistry.name);
  private readonly handlers = new Map<string, IPolicyHandler>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    // metadataScanner/reflector держим как зависимости для совместимости с будущим
    // сканом методов; на уровне классов хватает reflector по инстансу провайдера.
    void this.metadataScanner;
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as IPolicyHandler | undefined;
      if (!instance || typeof instance.evaluate !== 'function') continue;
      const name = this.reflector.get<string>(POLICY_HANDLER_NAME, instance.constructor);
      if (!name) continue;
      if (this.handlers.has(name))
        throw new Error(`Дубль политики Layer 3: '${name}' зарегистрирована дважды`);
      this.handlers.set(name, instance);
    }
    this.logger.log(`Зарегистрировано политик Layer 3: ${this.handlers.size} [${[...this.handlers.keys()].join(', ')}]`);
  }

  /** Зарегистрирована ли политика под этим именем. */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /** Политика по имени; бросает, если не зарегистрирована (fail-closed). */
  get(name: string): IPolicyHandler {
    const handler = this.handlers.get(name);
    if (!handler) throw new Error(`Политика Layer 3 не зарегистрирована: '${name}'`);
    return handler;
  }

  /** Исполнить политику по имени. Бросает на неизвестное имя; результат — допуск. */
  evaluate(name: string, context: PolicyEvaluationContext): boolean | Promise<boolean> {
    return this.get(name).evaluate(context);
  }
}
