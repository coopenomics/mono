import { Cooperative } from 'cooptypes';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { DigitalDocument } from 'src/shared/lib/document';
import { useSystemStore } from 'src/entities/System/model';
import { t } from '../i18n';

/**
 * Обработчики решений совета по заявлениям «Образовательного моста».
 *
 * `eduacptrid` — приём паевого взноса результатом интеллектуальной деятельности:
 * контракт ставит в повестку заявление преподавателя (3008), а протокол совета
 * (3009) собирается из его метаданных и номера решения. Автор повестки —
 * преподаватель, протокол и пишется о нём; состав совета, голоса и реквизиты
 * кооператива фабрика берёт сама по номеру решения.
 */
export function registerEdubridgeDecisionHandlers(): void {
  decisionFactory.registerHandler('eduacptrid', {
    generateHandler: async ({ decision_id, row }) => {
      if (!row.table?.statement?.meta) {
        throw new Error(t('edubridge.decision.ridMetaMissing'));
      }
      const statementMeta = JSON.parse(row.table.statement.meta) as Cooperative.Registry.EducationRidStatement.Action;
      if (!statementMeta.rid_hash || !statementMeta.amount) {
        throw new Error(t('edubridge.decision.ridMetaInvalid'));
      }
      const { info } = useSystemStore();
      const protocolAction: Cooperative.Registry.EducationRidDecision.Action = {
        registry_id: Cooperative.Registry.EducationRidDecision.registry_id,
        coopname: info.coopname,
        username: String(row.table.username),
        lang: 'ru',
        decision_id,
        rid_hash: statementMeta.rid_hash,
        amount: statementMeta.amount,
        rid_type: statementMeta.rid_type,
      };
      return await new DigitalDocument().generate(protocolAction, { lang: 'ru' });
    },
  });
}
