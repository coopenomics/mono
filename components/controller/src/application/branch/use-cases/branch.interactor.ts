import { BRANCH_BLOCKCHAIN_PORT, BranchBlockchainPort } from '~/domain/branch/interfaces/branch-blockchain.port';
import type { GetBranchesDomainInput } from '~/domain/branch/interfaces/get-branches-domain-input.interface';
import { BranchDomainEntity } from '~/domain/branch/entities/branch-domain.entity';
import { ORGANIZATION_REPOSITORY, OrganizationRepository } from '~/domain/common/repositories/organization.repository';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { CreateBranchDomainInput } from '~/domain/branch/interfaces/create-branch-domain-input.interface';
import httpStatus from 'http-status';
import type { EditBranchDomainInput } from '~/domain/branch/interfaces/edit-branch-domain-input.interface';
import type { DeleteBranchDomainInput } from '~/domain/branch/interfaces/delete-branch-domain-input';
import type { AddTrustedAccountDomainInterface } from '~/domain/branch/interfaces/add-trusted-account-domain-input.interface';
import type { DeleteTrustedAccountDomainInterface } from '~/domain/branch/interfaces/delete-trusted-account-domain-input.interface';
import type { SetBranchPrivateDomainInterface } from '~/domain/branch/interfaces/set-branch-private-domain-input.interface';
import type { AddBranchWhitelistDomainInterface } from '~/domain/branch/interfaces/add-branch-whitelist-domain-input.interface';
import type { DeleteBranchWhitelistDomainInterface } from '~/domain/branch/interfaces/delete-branch-whitelist-domain-input.interface';
import { INDIVIDUAL_REPOSITORY, IndividualRepository } from '~/domain/common/repositories/individual.repository';
import { IndividualDomainEntity } from '~/domain/branch/entities/individual-domain.entity';
import { OrganizationDomainEntity } from '~/domain/branch/entities/organization-domain.entity';
import { PAYMENT_METHOD_REPOSITORY, PaymentMethodRepository } from '~/domain/common/repositories/payment-method.repository';
import { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import { randomUUID } from 'crypto';
import { BankPaymentMethodDTO } from '~/application/payment-method/dto/bank-payment-method.dto';
import type { SelectBranchInputDomainInterface } from '~/domain/branch/interfaces/select-branch-domain-input.interface';
import config from '~/config/config';
import { Cooperative } from 'cooptypes';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '~/domain/document/repository/document.repository';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';
import { HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class BranchInteractor {
  private readonly logger = new Logger(BranchInteractor.name);

  constructor(
    @Inject(PAYMENT_METHOD_REPOSITORY) private readonly paymentMethodRepository: PaymentMethodRepository,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepository,
    @Inject(INDIVIDUAL_REPOSITORY) private readonly individualRepository: IndividualRepository,
    @Inject(DOCUMENT_REPOSITORY) private readonly documentRepository: DocumentRepository,
    @Inject(BRANCH_BLOCKCHAIN_PORT) private readonly branchBlockchainPort: BranchBlockchainPort,
    private readonly documentInteractor: DocumentInteractor
  ) {}

  // Количество пайщиков на каждом участке: участники совета (status accepted),
  // у которых проставлен braname. Председатель и доверенные участка — тоже пайщики
  // и входят в это число. Возвращаем карту braname → количество за одно чтение таблицы.
  private async countParticipantsByBranch(coopname: string): Promise<Map<string, number>> {
    const participants = await this.branchBlockchainPort.getParticipants(coopname);
    const counts = new Map<string, number>();
    for (const participant of participants) {
      if (participant.status === 'accepted' && participant.braname) {
        counts.set(participant.braname, (counts.get(participant.braname) ?? 0) + 1);
      }
    }
    return counts;
  }

  async getBranch(
    coopname: string,
    braname: string,
    participantsCount?: number,
    currentUsername?: string
  ): Promise<BranchDomainEntity> {
    const branch = await this.branchBlockchainPort.getBranch(coopname, braname);

    if (!branch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');
    }

    const databaseData = await this.organizationRepository.findByUsername(braname);
    const trusteeData = await this.individualRepository.findByUsername(branch.trustee);
    const trustedData: IndividualDomainEntity[] = [];

    for (const trusted of branch.trusted) {
      const tr = await this.individualRepository.findByUsername(trusted);
      trustedData.push(new IndividualDomainEntity(tr));
    }

    // белый список приватного участка — резолвим ФИО для управления председателем
    // (поля is_private/whitelist приходят из binary_extension контракта и могут отсутствовать у старых записей)
    const whitelist = branch.whitelist ?? [];
    const whitelistMembers: IndividualDomainEntity[] = [];
    for (const account of whitelist) {
      const member = await this.individualRepository.findByUsername(account);
      if (member) whitelistMembers.push(new IndividualDomainEntity(member));
    }

    // доступность участка для выбора текущим пайщиком: публичный либо пайщик в белом списке
    const isPrivate = branch.is_private ?? false;
    const isAvailable = !isPrivate || (!!currentUsername && whitelist.includes(currentUsername));

    const bankAccount = new BankPaymentMethodDTO(
      await this.paymentMethodRepository.get({
        username: braname,
        method_type: 'bank_transfer',
        is_default: true,
      })
    );

    // при одиночном запросе считаем число пайщиков сами; в списке оно приходит готовым
    const count = participantsCount ?? (await this.countParticipantsByBranch(coopname)).get(braname) ?? 0;

    return new BranchDomainEntity(
      coopname,
      branch,
      databaseData,
      trusteeData,
      trustedData,
      bankAccount,
      count,
      whitelistMembers,
      isAvailable
    );
  }

  async getBranches(data: GetBranchesDomainInput, currentUsername?: string): Promise<BranchDomainEntity[]> {
    const branches = await this.branchBlockchainPort.getBranches(data.coopname);

    // Фильтрация до сборки
    const filteredBranches = data.braname ? branches.filter((branch) => branch.braname === data.braname) : branches;

    // одно чтение таблицы участников на весь список, далее раздаём по braname
    const participantCounts = await this.countParticipantsByBranch(data.coopname);

    const result: BranchDomainEntity[] = [];
    for (const branch of filteredBranches) {
      try {
        const branchEntity = await this.getBranch(
          data.coopname,
          branch.braname,
          participantCounts.get(branch.braname) ?? 0,
          currentUsername
        );
        result.push(branchEntity);
      } catch (error) {
        // Карточка участка (организация/председатель/реквизиты) после одобрения советом
        // создаётся обработчиком события confirmdec асинхронно. Пока проекция не догнала
        // блокчейн, getBranch бросает «Организация не найдена». Пропускаем не-готовый
        // участок, чтобы один такой не ронял весь список — он появится на следующей загрузке.
        this.logger.warn(
          `getBranches: участок ${branch.braname} ещё не материализован — пропущен (${(error as Error).message})`
        );
      }
    }

    return result;
  }

  async createBranch(data: CreateBranchDomainInput): Promise<BranchDomainEntity> {
    // Проверяем существование участка
    const existingBranch = await this.branchBlockchainPort.getBranch(data.coopname, data.braname);

    if (existingBranch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок уже создан');
    }

    // извлекаем информацию о кооперативе
    const cooperative = await this.organizationRepository.findByUsername(data.coopname);

    //извлекаем информацию о председателе
    const trustee = new IndividualDomainEntity(await this.individualRepository.findByUsername(data.trustee));

    if (!cooperative) throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');

    // комбинируем с входящими данными о КУ
    const combinedData = new OrganizationDomainEntity({
      ...cooperative,
      ...data,
      represented_by: {
        first_name: trustee.first_name,
        last_name: trustee.last_name,
        middle_name: trustee.middle_name,
        based_on: data.based_on,
        position: 'председатель кооперативного участка',
      },
      username: data.braname,
    });

    // Сохраняем в базе данных
    await this.organizationRepository.create(combinedData);

    const cooperativeBank = await this.paymentMethodRepository.get({
      username: data.coopname,
      method_type: 'bank_transfer',
      is_default: true,
    });

    const paymentMethod = new PaymentMethodDomainEntity({
      username: data.braname,
      method_id: randomUUID().toString(),
      method_type: 'bank_transfer',
      data: cooperativeBank.data,
      is_default: true,
    });

    await this.paymentMethodRepository.save(paymentMethod);

    // Уведомляем блокчейн через порт
    await this.branchBlockchainPort.createBranch({
      coopname: data.coopname,
      braname: data.braname,
      trustee: data.trustee,
    });

    return this.getBranch(data.coopname, data.braname);
  }

  async editBranch(data: EditBranchDomainInput): Promise<BranchDomainEntity> {
    // Проверяем существование участка
    const existingBranch = await this.branchBlockchainPort.getBranch(data.coopname, data.braname);

    if (!existingBranch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');
    }

    // Извлекаем информацию о кооперативе
    const cooperative = await this.organizationRepository.findByUsername(data.coopname);

    if (!cooperative) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооператив не найден');
    }
    const organizationEntity = new OrganizationDomainEntity(cooperative);

    // Извлекаем информацию о председателе
    const trustee = new IndividualDomainEntity(await this.individualRepository.findByUsername(data.trustee));

    if (!trustee) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Председатель не найден');
    }

    // Комбинируем с новыми данными о КУ
    const updatedData = new OrganizationDomainEntity({
      ...organizationEntity,
      ...data,
      represented_by: {
        first_name: trustee.first_name,
        last_name: trustee.last_name,
        middle_name: trustee.middle_name,
        based_on: data.based_on,
        position: 'председатель кооперативного участка',
      },
      username: data.braname,
    });

    // Обновляем в базе данных
    await this.organizationRepository.create(updatedData);

    // Уведомляем блокчейн через порт
    await this.branchBlockchainPort.editBranch({
      coopname: data.coopname,
      braname: data.braname,
      trustee: data.trustee,
    });

    // Возвращаем обновленный участок
    return this.getBranch(data.coopname, data.braname);
  }

  async deleteBranch(data: DeleteBranchDomainInput): Promise<boolean> {
    // Проверяем существование участка
    const existingBranch = await this.branchBlockchainPort.getBranch(data.coopname, data.braname);

    if (!existingBranch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');
    }

    // Уведомляем блокчейн через порт
    await this.branchBlockchainPort.deleteBranch({
      coopname: data.coopname,
      braname: data.braname,
    });

    return true;
  }

  async addTrustedAccount(data: AddTrustedAccountDomainInterface): Promise<BranchDomainEntity> {
    // Проверяем существование участка
    const existingBranch = await this.branchBlockchainPort.getBranch(data.coopname, data.braname);

    if (!existingBranch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');
    }

    // Уведомляем блокчейн через порт
    await this.branchBlockchainPort.addTrustedAccount({
      coopname: data.coopname,
      braname: data.braname,
      trusted: data.trusted,
    });

    return await this.getBranch(data.coopname, data.braname);
  }

  async deleteTrustedAccount(data: DeleteTrustedAccountDomainInterface): Promise<BranchDomainEntity> {
    // Проверяем существование участка
    const existingBranch = await this.branchBlockchainPort.getBranch(data.coopname, data.braname);

    if (!existingBranch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');
    }

    // Уведомляем блокчейн через порт
    await this.branchBlockchainPort.deleteTrustedAccount({
      coopname: data.coopname,
      braname: data.braname,
      trusted: data.trusted,
    });

    return await this.getBranch(data.coopname, data.braname);
  }

  async setBranchPrivate(data: SetBranchPrivateDomainInterface): Promise<BranchDomainEntity> {
    const existingBranch = await this.branchBlockchainPort.getBranch(data.coopname, data.braname);

    if (!existingBranch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');
    }

    await this.branchBlockchainPort.setBranchPrivate({
      coopname: data.coopname,
      braname: data.braname,
      is_private: data.is_private,
    });

    return await this.getBranch(data.coopname, data.braname);
  }

  async addBranchWhitelist(data: AddBranchWhitelistDomainInterface): Promise<BranchDomainEntity> {
    const existingBranch = await this.branchBlockchainPort.getBranch(data.coopname, data.braname);

    if (!existingBranch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');
    }

    await this.branchBlockchainPort.addBranchWhitelist({
      coopname: data.coopname,
      braname: data.braname,
      account: data.account,
    });

    return await this.getBranch(data.coopname, data.braname);
  }

  async deleteBranchWhitelist(data: DeleteBranchWhitelistDomainInterface): Promise<BranchDomainEntity> {
    const existingBranch = await this.branchBlockchainPort.getBranch(data.coopname, data.braname);

    if (!existingBranch) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Кооперативный участок не найден');
    }

    await this.branchBlockchainPort.deleteBranchWhitelist({
      coopname: data.coopname,
      braname: data.braname,
      account: data.account,
    });

    return await this.getBranch(data.coopname, data.braname);
  }

  async selectBranch(data: SelectBranchInputDomainInterface): Promise<boolean> {
    // TODO move it to separate document domain service for validate
    const document = await this.documentRepository.findByHash(data.document.doc_hash);
    if (!document) throw new BadRequestException('Документ не найден');

    if (data.document.meta.registry_id != Cooperative.Registry.SelectBranchStatement.registry_id)
      throw new BadRequestException('Неверный registry_id в переданном документе, ожидается registry_id == 101');

    if (data.coopname != config.coopname)
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Указанное имя аккаунта кооператива не обслуживается здесь');

    await this.branchBlockchainPort.selectBranch({
      coopname: data.coopname,
      username: data.username,
      braname: data.braname,
      document: { ...data.document, meta: JSON.stringify(data.document.meta) },
    });

    return true;
  }

  async generateSelectBranchDocument(
    data: Cooperative.Registry.SelectBranchStatement.Action,
    options: Cooperative.Document.IGenerationOptions
  ): Promise<DocumentDomainEntity> {
    data.registry_id = Cooperative.Registry.SelectBranchStatement.registry_id;
    return await this.documentInteractor.generateDocument({ data, options });
  }
}
