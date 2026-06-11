import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { AppAbility } from './ability.types';
import { mapUserRoleToCoreRoles } from './core-roles';

/** Пайщик, для которого собирается Ability (минимум из JWT-сессии). */
export interface IAbilitySubjectUser {
  username: string;
  role?: string | null;
}

/**
 * Layer 1 (Static Ability) CASL-авторизации (Story 6.1). По логину пайщика
 * собирает его `AppAbility` из core-ролей (`mapUserRoleToCoreRoles`) по статической
 * матрице «роль→возможности». Матрица аддитивна: Chairman наследует права Member,
 * Member — права User (иерархия core-ролей).
 *
 * Ownership self-субъектов (свой Certificate/Session/RecoveryStrategy) вшит в
 * условие `{ owner: username }` прямо в Ability — это даёт реальный CASL (в отличие
 * от marketplace `canAccess`, где ownership проверял resolver). DB-зависимые
 * политики (например «голосовать только в своём кооперативе») — Layer 3 (Story 6.3).
 */
@Injectable()
export class AbilityFactory {
  createForParticipant(user: IAbilitySubjectUser): AppAbility {
    const coreRoles = mapUserRoleToCoreRoles(user.role);
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const owner = { owner: user.username };

    // User — любой пайщик: полный контроль над собственными сущностями.
    if (coreRoles.includes('User')) {
      can('read', 'Certificate', owner);
      can(['read', 'update'], 'Session', owner);
      can('manage', 'RecoveryStrategy', owner); // вкл. настройки 2FA
    }

    // Member — член совета: read-only надзор + роль второго подписанта critical-action.
    if (coreRoles.includes('Member')) {
      can('read', 'Participant');
      can('read', 'VerificationRule');
      can('read', 'CriticalAction');
      can('read', 'AuditEvent');
      can('confirm', 'CriticalAction'); // второй подписант (Story 6.8)
    }

    // Chairman — председатель: write-модерация + инициация critical-action.
    if (coreRoles.includes('Chairman')) {
      can('manage', 'VerificationRule');
      can('manage', 'CoopSettings');
      can('update', 'Participant'); // назначение ролей (Story 6.6)
      can('create', 'Capability'); // выдача точечных capabilities (Story 6.7)
      can('create', 'CriticalAction'); // инициатор; финал — только 2 подписи (Story 6.8)
    }

    return build();
  }
}
