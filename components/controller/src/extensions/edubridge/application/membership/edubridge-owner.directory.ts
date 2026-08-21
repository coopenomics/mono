import { Inject, Injectable } from '@nestjs/common';
import { USER_DIRECTORY_PORT, type IUserDirectoryPort } from '@coopenomics/innercoop';

/** Кто «владелец» приложения в кооперативе — председатель (ядро знает роли). */
@Injectable()
export class EdubridgeOwnerDirectory {
  constructor(@Inject(USER_DIRECTORY_PORT) private readonly users: IUserDirectoryPort) {}

  async chairman(_coopname: string): Promise<string | null> {
    const [chairman] = await this.users.findByRoles(['chairman']);
    return chairman?.username ?? null;
  }
}
