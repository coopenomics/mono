import { Injectable } from '@nestjs/common';
import type { IEdubridgeRoleFactsPort } from './edubridge-role-facts.port';
import type { EdubridgeRoleFacts } from './edubridge-roles.mapper';

/**
 * Каркас (E1): фактов ещё нет — все пайщики без ролей приложения.
 * Заменяется реализацией на портах AGREEMENT/PROGRAM_AGREEMENT и таблице
 * администраторов в E5/E9.
 */
@Injectable()
export class EdubridgeRoleFactsStub implements IEdubridgeRoleFactsPort {
  async resolve(): Promise<EdubridgeRoleFacts> {
    return { isLearner: false, isTeacher: false, isAdmin: false };
  }
}
