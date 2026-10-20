import { DomainError } from '@coopenomics/extension-kit';
import type { VarsDomainInterface } from '~/domain/system/interfaces/vars-domain.interface';

/**
 * Новые значения параметров кооператива поверх текущих.
 *
 * Документ vars сохраняется новой версией целиком, а пишут в него не только
 * формы ядра: расширения и решения совета дописывают свои поля (например,
 * реквизиты протокола положения об образовании — vars.education_provision).
 * Форма председателя знает только поля ядра; без слияния её сохранение стирало
 * бы всё остальное, и документы расширений теряли реквизиты утверждения.
 */
export function mergeVars(current: VarsDomainInterface | null, incoming: VarsDomainInterface): VarsDomainInterface {
  // Служебные поля хранилища в новую версию не переносятся.
  const { _id, block_num, deleted, ...kept } = (current ?? {}) as Record<string, unknown>;
  void _id;
  void block_num;
  void deleted;
  return { ...kept, ...incoming } as VarsDomainInterface;
}

/**
 * Проверить и подготовить новую версию параметров к сохранению.
 *
 * Имя кооператива в параметрах обязано быть именем этого узла: пустое или чужое
 * имя ломает все документы, которые фабрика соберёт по этим параметрам.
 */
export function prepareVarsUpdate(
  current: VarsDomainInterface | null,
  incoming: VarsDomainInterface,
  coopname: string
): VarsDomainInterface {
  if (!coopname || incoming.coopname !== coopname) {
    throw DomainError.badRequest('SYSTEM_VARS_COOPNAME_MISMATCH', {
      expected: coopname,
      received: incoming.coopname ?? '',
    });
  }
  return mergeVars(current, incoming);
}
