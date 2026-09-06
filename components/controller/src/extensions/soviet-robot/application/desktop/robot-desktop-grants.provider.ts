import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  DESKTOP_GRANTS_REGISTRY_PORT,
  MonoAccountStatus,
  type IDesktopGrantsHook,
  type IDesktopGrantsRegistryPort,
  type InnerDesktopGrantsContext,
} from '@coopenomics/innercoop';
import { ROBOT_EXTENSION_NAME } from '../../domain/constants';

/** Права стола «Робот совета». */
export const ROBOT_GRANTS = {
  /** Видеть реестр действий автоматизации и журнал. */
  READ: 'Robot:read',
  /** Делегировать роботу свой голос и отзывать делегирование. */
  DELEGATE: 'Robot:delegate',
  /** Делегировать подпись протоколов (председатель). */
  AUTHORIZE: 'Robot:authorize',
  /** Состояние робота, ошибки, ручной повтор (председатель). */
  ADMIN: 'Robot:admin',
} as const;

/**
 * Стол «Робот совета» открыт только членам совета: рядовой пайщик и гость
 * получают пустой набор и стола не видят. Председатель дополнительно
 * управляет автоматизацией протоколов и видит административную страницу.
 */
@Injectable()
export class RobotDesktopGrantsProvider implements IDesktopGrantsHook, OnModuleInit {
  readonly extensionName = ROBOT_EXTENSION_NAME;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly registry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async resolveGrants(ctx: InnerDesktopGrantsContext): Promise<string[]> {
    if (!ctx.username || ctx.userStatus !== MonoAccountStatus.Active) return [];
    const role = String(ctx.userRole ?? '').toLowerCase();
    if (role === 'chairman') return [ROBOT_GRANTS.READ, ROBOT_GRANTS.DELEGATE, ROBOT_GRANTS.AUTHORIZE, ROBOT_GRANTS.ADMIN];
    if (role === 'member') return [ROBOT_GRANTS.READ, ROBOT_GRANTS.DELEGATE];
    return [];
  }
}
