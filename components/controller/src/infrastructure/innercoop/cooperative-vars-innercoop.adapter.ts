import { Inject, Injectable } from '@nestjs/common';
import type { ICooperativeVarsPort, InnerCooperativeVars } from '@coopenomics/innercoop';
import { VARS_REPOSITORY, type VarsRepository } from '~/domain/common/repositories/vars.repository';

/**
 * Реализация `ICooperativeVarsPort` для расширений.
 *
 * Сужает `VarsDomainInterface` до трёх полей: расширения читают только их, а
 * отдавать наружу номера соглашений, ссылки на политику и почты кооператива
 * незачем. Заодно снимает индексную сигнатуру `[x: string]: unknown`, из-за
 * которой у потребителя пропадала проверка опечаток в имени поля.
 */
@Injectable()
export class CooperativeVarsInnercoopAdapter implements ICooperativeVarsPort {
  constructor(@Inject(VARS_REPOSITORY) private readonly varsRepository: VarsRepository) {}

  async get(): Promise<InnerCooperativeVars | null> {
    const vars = await this.varsRepository.get();
    if (!vars) return null;

    return {
      coopname: vars.coopname,
      name: vars.name,
      shortAbbr: vars.short_abbr,
    };
  }
}
