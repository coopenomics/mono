import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import { Action } from './actions';
import { Subject } from './subjects';

export type AppAbility = MongoAbility<[Action, Subject]>;

export interface UserForAbility {
  username: string;
  role: 'chairman' | 'member' | 'user';
  /** Дополнительные гранулированные права (future) */
  permissions?: GrantedPermission[];
}

export interface GrantedPermission {
  action: Action;
  subject: Subject;
  conditions?: Record<string, any>;
}

/**
 * Фабрика CASL abilities.
 * Создаёт набор прав на основе роли + гранулированных разрешений.
 * Обратная совместимость: chairman/member/user сохраняют текущие права.
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserForAbility): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    switch (user.role) {
      case 'chairman':
        can(Action.Manage, Subject.All);
        break;

      case 'member':
        can(Action.Read, Subject.All);
        can(Action.Create, Subject.Issue);
        can(Action.Update, Subject.Issue);
        can(Action.Create, Subject.Commit);
        can(Action.Execute, Subject.Decision);
        can(Action.Read, Subject.Payment);
        can(Action.Read, Subject.Participant);
        can(Action.Read, Subject.Document);
        can(Action.Read, Subject.Meet);
        can(Action.Read, Subject.Ledger);
        can(Action.Create, Subject.Process);
        can(Action.Update, Subject.Process);
        can(Action.Read, Subject.Report);
        can(Action.Share, Subject.All);
        // member не может управлять системой и расширениями
        cannot(Action.Manage, Subject.System);
        cannot(Action.Manage, Subject.Extension);
        break;

      case 'user':
        // user может читать свои данные
        can(Action.Read, Subject.Wallet);
        can(Action.Read, Subject.Profile);
        can(Action.Read, Subject.UserDocument);
        can(Action.Read, Subject.UserPayment);
        can(Action.Read, Subject.Meet);
        can(Action.Read, Subject.Search);
        // user может обновлять свой профиль
        can(Action.Update, Subject.Profile);
        // user может работать с задачами
        can(Action.Read, Subject.Issue);
        can(Action.Update, Subject.Issue);
        break;
    }

    // Применяем гранулированные права (из share tokens и т.д.)
    if (user.permissions) {
      for (const perm of user.permissions) {
        can(perm.action, perm.subject, perm.conditions);
      }
    }

    return build();
  }
}
