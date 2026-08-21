import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import moment from 'moment';
import { Cooperative } from 'cooptypes';
import {
  LOGGER_PORT,
  REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
  USER_DATA_PORT,
  type ILoggerPort,
  type IProgramOfferParametersHook,
  type IRegistrationDocumentParametersRegistryPort,
  type IUserDataPort,
} from '@coopenomics/innercoop';
import { EDU_LEARNING_PROGRAM_KEY, EDU_TEACHING_PROGRAM_KEY } from '../../constants/edubridge-agreement-ids';

const UdataKey = Cooperative.Model.UdataKey;

/**
 * Персональные номер и дата оферты — в Udata до генерации документа; фабрики
 * 3002/3004 читают их оттуда, чтобы повторный рендер давал тот же хэш, что
 * подписал пайщик. Идемпотентно: выданный номер не перевыпускается.
 */
abstract class EdubridgeOfferParametersBase implements IProgramOfferParametersHook {
  abstract readonly programKey: string;
  protected abstract readonly numberKey: string;
  protected abstract readonly createdAtKey: string;
  protected abstract readonly human: string;

  constructor(
    protected readonly udata: IUserDataPort,
    protected readonly logger: ILoggerPort
  ) {}

  async generateOfferParameters(coopname: string, username: string): Promise<void> {
    const existing = await this.udata.get(coopname, username, this.numberKey);
    if (existing?.value) {
      this.logger.info(`Параметры ${this.human} уже выданы для ${username}: ${existing.value}`);
      return;
    }
    const number = randomBytes(32).toString('hex').substring(0, 16).toUpperCase();
    const createdAt = moment().format('DD.MM.YYYY');
    await this.udata.save({ coopname, username, key: this.numberKey, value: number });
    await this.udata.save({ coopname, username, key: this.createdAtKey, value: createdAt });
    this.logger.info(`Выданы параметры ${this.human} для ${username}: № ${number} от ${createdAt}`);
  }
}

class ParentOfferParameters extends EdubridgeOfferParametersBase {
  readonly programKey = EDU_LEARNING_PROGRAM_KEY;
  protected readonly numberKey = UdataKey.EDUCATION_PARENT_AGREEMENT_NUMBER;
  protected readonly createdAtKey = UdataKey.EDUCATION_PARENT_AGREEMENT_CREATED_AT;
  protected readonly human = 'оферты родителя-слушателя';
}

class TeacherOfferParameters extends EdubridgeOfferParametersBase {
  readonly programKey = EDU_TEACHING_PROGRAM_KEY;
  protected readonly numberKey = UdataKey.EDUCATION_TEACHER_AGREEMENT_NUMBER;
  protected readonly createdAtKey = UdataKey.EDUCATION_TEACHER_AGREEMENT_CREATED_AT;
  protected readonly human = 'оферты преподавателя';
}

/** Кладёт оба хука в реестр ядра при запуске; ядро расширение не импортирует. */
@Injectable()
export class EdubridgeUdataParametersAdapter implements OnModuleInit {
  constructor(
    @Inject(USER_DATA_PORT) private readonly udata: IUserDataPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT)
    private readonly registry: IRegistrationDocumentParametersRegistryPort
  ) {
    this.logger.setContext(EdubridgeUdataParametersAdapter.name);
  }

  onModuleInit(): void {
    this.registry.registerProgramOfferHook(new ParentOfferParameters(this.udata, this.logger));
    this.registry.registerProgramOfferHook(new TeacherOfferParameters(this.udata, this.logger));
  }
}
