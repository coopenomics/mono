import { Resolver, Query, Args, Mutation, ResolveField, Parent } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { VAULT_REPOSITORY } from '~/domain/auth-v2/vault/vault-repository.port';
import type { IVaultRepository } from '~/domain/auth-v2/vault/vault-repository.port';
import { AccountService } from '../services/account.service';
import { AccountDTO } from '../dto/account.dto';
import { GetAccountInputDTO } from '../dto/get-account-input.dto';
import { UseGuards } from '@nestjs/common';
import { AuthRoles, GqlJwtAuthGuard, RolesGuard, createPaginationResult, PaginationInputDTO, CurrentUser } from '@coopenomics/extension-kit';
import { GetAccountsInputDTO } from '../dto/get-accounts-input.dto';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import { RegisterAccountInputDTO } from '../dto/register-account-input.dto';
import { RegisteredAccountDTO } from '../dto/registered-account.dto';
import { UpdateAccountInputDTO } from '../dto/update-account-input.dto';
import { PassportInputDTO } from '../dto/passport-input.dto';
import { DeleteAccountInputDTO } from '../dto/delete-account-input.dto';
import { SearchPrivateAccountsInputDTO } from '../dto/search-private-accounts-input.dto';
import { PrivateAccountSearchResultDTO } from '../dto/search-private-accounts-result.dto';
import { IMonoAccount } from '@coopenomics/innercoop';

export const AccountsPaginationResult = createPaginationResult(AccountDTO, 'Accounts');

@Resolver(() => AccountDTO)
export class AccountResolver {
  constructor(
    private readonly accountService: AccountService,
    @Inject(VAULT_REPOSITORY) private readonly vaultRepo: IVaultRepository
  ) {}

  @ResolveField('has_password', () => Boolean, {
    description:
      'Установлен ли у аккаунта пароль входа. Пока пароль не установлен, действует вход по ключу доступа; после установки вход возможен только по email и паролю.',
  })
  async hasPassword(@Parent() account: AccountDTO): Promise<boolean> {
    // Признак — существование зашифрованного vault-блоба пайщика: без него вход
    // по паролю невозможен по построению. Поле вычисляется только когда явно
    // запрошено клиентом — реестры аккаунтов, не выбирающие его, не платят
    // лишним запросом на строку.
    const blob = await this.vaultRepo.find({ subject_type: 'participant', subject_id: account.username });
    return blob !== null;
  }

  @Query(() => AccountDTO, {
    name: 'getAccount',
    description: 'Получить сводную информацию о аккаунте',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getAccount(@Args('data', { type: () => GetAccountInputDTO }) input: GetAccountInputDTO): Promise<AccountDTO> {
    return this.accountService.getAccount(input.username);
  }

  @Query(() => AccountsPaginationResult, {
    name: 'getAccounts',
    description: 'Получить сводную информацию о аккаунтах системы',
  })
  @AuthRoles(['chairman', 'member'])
  async getAccounts(
    @Args('data', { type: () => GetAccountsInputDTO, nullable: true }) data?: GetAccountsInputDTO,
    @Args('options', { type: () => PaginationInputDTO, nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResultDomainInterface<AccountDTO>> {
    return await this.accountService.getAccounts(data, options);
  }

  @Query(() => [PrivateAccountSearchResultDTO], {
    name: 'searchPrivateAccounts',
    description:
      'Поиск приватных данных аккаунтов по запросу. Поиск осуществляется по полям ФИО, ИНН, ОГРН, наименованию организации и другим приватным данным.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async searchPrivateAccounts(
    @Args('data', { type: () => SearchPrivateAccountsInputDTO }) data: SearchPrivateAccountsInputDTO
  ): Promise<PrivateAccountSearchResultDTO[]> {
    return this.accountService.searchPrivateAccounts(data);
  }

  @Mutation(() => RegisteredAccountDTO, {
    name: 'registerAccount',
    description: 'Зарегистрировать аккаунт пользователя в системе',
  })
  //TODO:
  // @UseGuards(GqlJwtAuthGuard, RolesGuard)
  async registerAccount(
    @Args('data', { type: () => RegisterAccountInputDTO })
    data: RegisterAccountInputDTO
  ): Promise<RegisteredAccountDTO> {
    return this.accountService.registerAccount(data);
  }

  @Mutation(() => Boolean, {
    name: 'deleteAccount',
    description:
      'Удалить аккаунт пайщика из системы учёта провайдера. Доступно только для незавершённых регистрационных статусов (черновик, неоплачен/отклонён). Активный, заблокированный и любой зарегистрированный в блокчейне аккаунт удалить нельзя. Используется для очистки реестра и освобождения e-mail под перерегистрацию.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deleteAccount(
    @Args('data', { type: () => DeleteAccountInputDTO })
    data: DeleteAccountInputDTO
  ): Promise<boolean> {
    await this.accountService.deleteAccount(data);

    return true;
  }

  @Mutation(() => AccountDTO, {
    name: 'resetRegistration',
    description:
      'Откатить собственную незавершённую регистрацию к редактированию данных: снимает заморозку профиля и e-mail, сбрасывает подписанное заявление и непринятую попытку вступительного платежа. Доступно только до отправки регистрации в блокчейн; если взнос уже принят — требуется возврат средств.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async resetRegistration(@CurrentUser() currentUser: IMonoAccount): Promise<AccountDTO> {
    return await this.accountService.resetRegistration(currentUser.username);
  }

  @Mutation(() => AccountDTO, {
    name: 'updateAccount',
    description:
      'Обновить аккаунт в системе провайдера. Обновление аккаунта пользователя производится по username. Мутация позволяет изменить приватные данные пользователя, а также, адрес электронной почты в MONO. Использовать мутацию может только председатель совета.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async updateAccount(
    @Args('data', { type: () => UpdateAccountInputDTO })
    data: UpdateAccountInputDTO
  ): Promise<AccountDTO> {
    return await this.accountService.updateAccount(data);
  }

  @Mutation(() => AccountDTO, {
    name: 'saveMyPassport',
    description:
      'Сохранить собственные паспортные данные в реестре пайщиков. Применяется, когда паспорт ранее не был указан (например, при подписании договора материальной ответственности председателем кооперативного участка или доверенным лицом). Если паспортные данные уже установлены — они не перезаписываются.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async saveMyPassport(
    @Args('passport', { type: () => PassportInputDTO }) passport: PassportInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<AccountDTO> {
    return await this.accountService.saveOwnPassport(currentUser.username, passport);
  }
}
