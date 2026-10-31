import { ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { api } from '../api';
import type { IProgramProperty, PropertyPositionForm } from './types';

export * from './types';

/**
 * Паевой взнос имуществом в «Благорост» со стороны пайщика: подать заявление
 * и подписать акт приёма-передачи. Вторую подпись председатель ставит в
 * запросах одобрений, решение принимает совет — здесь этих шагов нет.
 *
 * Сервер отвечает после факта из цепи (ADR-009): после мутации экран
 * перечитывает список сразу, без пауз.
 */
export function useProgramProperty() {
  const system = useSystemStore();
  const session = useSessionStore();
  const isSubmitting = ref(false);

  /** Оценка в формате цепи: точность и символ токена кооператива. */
  function toAsset(amount: number): string {
    const { root_govern_precision, root_govern_symbol } = system.info.symbols;
    return `${amount.toFixed(root_govern_precision)} ${root_govern_symbol}`;
  }

  async function submitStatement(form: PropertyPositionForm): Promise<void> {
    isSubmitting.value = true;
    try {
      const document = await api.generateStatement({
        coopname: system.info.coopname,
        username: session.username,
        property_hash: await generateUniqueHash(),
        property_name: form.name.trim(),
        property_description: form.description.trim(),
        property_quantity: form.quantity.trim(),
        property_unit: form.unit.trim(),
        property_amount: toAsset(Number(form.amount)),
      });
      const statement = await new DigitalDocument(document).sign(session.username);
      await api.createProgramProperty({
        coopname: system.info.coopname,
        username: session.username,
        statement,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  async function signAct(property: IProgramProperty): Promise<void> {
    isSubmitting.value = true;
    try {
      const document = await api.generateAct({
        coopname: system.info.coopname,
        username: session.username,
        property_hash: property.property_hash,
      });
      const act = await new DigitalDocument(document).sign(session.username);
      await api.signAct({
        coopname: system.info.coopname,
        username: session.username,
        property_hash: property.property_hash,
        act,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  return { submitStatement, signAct, isSubmitting };
}
