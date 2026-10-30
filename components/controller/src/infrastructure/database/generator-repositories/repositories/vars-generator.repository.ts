// infrastructure/repositories/organization.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import type { VarsRepository } from '~/domain/common/repositories/vars.repository';
import type { VarsDomainInterface } from '~/domain/system/interfaces/vars-domain.interface';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import type { IVars } from '@coopenomics/docs-templates';

@Injectable()
export class VarsRepositoryImplementation implements VarsRepository {
  constructor(@Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort) {}

  async get(): Promise<VarsDomainInterface | null> {
    // Используем генератор для извлечения данных из базы
    const vars = await this.generatorPort.get('vars', {});
    return vars as VarsDomainInterface;
  }

  async create(data: VarsDomainInterface): Promise<void> {
    // Служебные поля записи хранилища фабрики — не данные кооператива; новая версия без них
    const { _id, block_num: _block_num, deleted: _deleted, ...cleanData } = data as any;
    //TODO исключить приведение типов здесь после нормальной типизации генератора
    await this.generatorPort.save('vars', cleanData as IVars);
  }
}
