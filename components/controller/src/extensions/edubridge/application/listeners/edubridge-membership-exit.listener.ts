import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RegistratorContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, type InnerChainActionRecord } from '@coopenomics/innercoop';
import { EdubridgeEnrollmentService } from '../services/edubridge-enrollment.service';
import { EdubridgeTeacherService } from '../services/edubridge-teacher.service';

/**
 * Выход пайщика из кооператива (`registrator::exitcoop` — заявление подано):
 * подписки его обучающихся закрываются с расчётом возврата по Положению, как
 * при отказе участника, и доступ отзывается. Возврат ложится на кошелёк
 * программы и входит в сумму выхода, которую кооператив вернёт после решения
 * совета. Закрываем по заявлению, а не по финальному расчёту: членство
 * кончается с выходом, а не с возвратом денег.
 *
 * Договор участия в хозяйственной деятельности прекращается тем же событием:
 * он действует, пока преподаватель — пайщик. Открытых обязательств к этому
 * моменту нет — их держат причины, которые ядро спрашивает до подачи заявления.
 */
@Injectable()
export class EdubridgeMembershipExitListener {
  constructor(
    private readonly enrollments: EdubridgeEnrollmentService,
    private readonly teachers: EdubridgeTeacherService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeMembershipExitListener.name);
  }

  @OnEvent(`action::${RegistratorContract.contractName.production}::${RegistratorContract.Actions.ExitCoop.actionName}`)
  async onExit(action: InnerChainActionRecord): Promise<void> {
    const data = action.data as RegistratorContract.Actions.ExitCoop.IExitCoop & { username?: string };
    if (!data?.coopname || !data?.username) return;
    await this.enrollments.cancelAllForMember(String(data.coopname), String(data.username), `exitcoop ${action.transaction_id}`);
    try {
      await this.teachers.terminateContract(String(data.coopname), String(data.username), 'выход преподавателя из кооператива');
    } catch (e) {
      this.logger.error(`[EDU.TEACH] выход ${data.username}: договор УХД не прекращён — ${(e as Error)?.message ?? e}`);
    }
  }
}
