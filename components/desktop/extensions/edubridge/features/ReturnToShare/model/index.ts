import { Zeus, type Mutations, type Queries } from '@coopenomics/sdk';
import { t } from '../../../i18n';

export type IReturnBalance = Queries.Edubridge.ReturnBalance.IOutput['edubridgeReturnBalance'];
export type IReturnRequest = Queries.Edubridge.MyReturnRequests.IOutput['edubridgeMyReturnRequests'][number];
export type IRequestReturnInput = Mutations.Edubridge.RequestReturn.IInput['data'];
export type IDeclineReturnInput = Mutations.Edubridge.DeclineReturn.IInput['data'];
/** Заявление об аннулировании соглашения (190), сформированное для подписи. */
export type IProgramAnnulmentDocument =
  Mutations.MembershipExit.GenerateProgramAgreementsAnnulment.IOutput[typeof Mutations.MembershipExit.GenerateProgramAgreementsAnnulment.name];

/** Программа «Обучение» ЦПП «Образование» в реестре программ кооператива. */
export const EDU_LEARNER_PROGRAM_ID = 5;

export const RETURN_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'neg' | 'warn' | 'info' | 'neutral' }> = {
  [Zeus.EduReturnStatus.PENDING]: { label: t('edubridge.returnRequest.status.PENDING'), variant: 'info' },
  [Zeus.EduReturnStatus.APPROVED]: { label: t('edubridge.returnRequest.status.APPROVED'), variant: 'pos' },
  [Zeus.EduReturnStatus.DECLINED]: { label: t('edubridge.returnRequest.status.DECLINED'), variant: 'neg' },
};
