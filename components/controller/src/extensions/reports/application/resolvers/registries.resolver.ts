import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  GetLedger2HistoryInputDTO,
  GetLedger2PostingsInputDTO,
  GqlJwtAuthGuard,
  Ledger2AccountDTO,
  Ledger2HistoryResponseDTO,
  Ledger2PostingsResponseDTO,
  Ledger2WalletDTO,
  PaginatedProcessSummary,
  PaginationInputDTO,
  PaginationResult,
  ProcessSummaryDTO,
  ProcessViewDTO,
  ProcessesFilterInput,
  RequireRight,
  RightsGuard,
} from '@coopenomics/extension-kit';
import { ReportsParticipantDTO, ReportsParticipantWalletDTO, ReportsSubjectDTO } from '../dto/registries.dto';
import { ReportsRegistriesService } from '../services/registries.service';

/**
 * Реестры Стола бухгалтера. Операции стола под его собственным правом
 * `Registry:read`: читают член совета, председатель и бухгалтер.
 */
@Resolver()
@UseGuards(GqlJwtAuthGuard, RightsGuard)
export class ReportsRegistriesResolver {
  constructor(private readonly registries: ReportsRegistriesService) {}

  @Query(() => [Ledger2AccountDTO], { name: 'reportsLedgerAccounts', description: 'Стол бухгалтера: счета плана счетов с остатками' })
  @RequireRight('Registry', 'read')
  async reportsLedgerAccounts(@Args('coopname', { type: () => String }) coopname: string): Promise<Ledger2AccountDTO[]> {
    return this.registries.ledgerAccounts(coopname);
  }

  @Query(() => [Ledger2WalletDTO], { name: 'reportsLedgerWallets', description: 'Стол бухгалтера: кошельки кооператива с остатками' })
  @RequireRight('Registry', 'read')
  async reportsLedgerWallets(@Args('coopname', { type: () => String }) coopname: string): Promise<Ledger2WalletDTO[]> {
    return this.registries.ledgerWallets(coopname);
  }

  @Query(() => Ledger2HistoryResponseDTO, { name: 'reportsLedgerHistory', description: 'Стол бухгалтера: реестр операций' })
  @RequireRight('Registry', 'read')
  async reportsLedgerHistory(
    @Args('input', { type: () => GetLedger2HistoryInputDTO }) input: GetLedger2HistoryInputDTO
  ): Promise<Ledger2HistoryResponseDTO> {
    return this.registries.ledgerHistory(input);
  }

  @Query(() => Ledger2PostingsResponseDTO, { name: 'reportsLedgerPostings', description: 'Стол бухгалтера: реестр проводок' })
  @RequireRight('Registry', 'read')
  async reportsLedgerPostings(
    @Args('input', { type: () => GetLedger2PostingsInputDTO }) input: GetLedger2PostingsInputDTO
  ): Promise<Ledger2PostingsResponseDTO> {
    return this.registries.ledgerPostings(input);
  }

  @Query(() => ProcessViewDTO, { name: 'reportsProcess', description: 'Стол бухгалтера: процесс целиком по его идентификатору' })
  @RequireRight('Registry', 'read')
  async reportsProcess(
    @Args('hash', { type: () => String }) hash: string,
    @Args('coopname', { type: () => String }) coopname: string
  ): Promise<ProcessViewDTO> {
    return this.registries.process(hash, coopname);
  }

  @Query(() => PaginatedProcessSummary, { name: 'reportsProcesses', description: 'Стол бухгалтера: реестр процессов' })
  @RequireRight('Registry', 'read')
  async reportsProcesses(
    @Args('filter', { type: () => ProcessesFilterInput }) filter: ProcessesFilterInput,
    @Args('pagination', { type: () => PaginationInputDTO }) pagination: PaginationInputDTO
  ): Promise<PaginationResult<ProcessSummaryDTO>> {
    return this.registries.processes(filter, pagination);
  }

  @Query(() => [ReportsParticipantDTO], { name: 'reportsParticipants', description: 'Стол бухгалтера: принятые пайщики с именами для реестров' })
  @RequireRight('Registry', 'read')
  async reportsParticipants(): Promise<ReportsParticipantDTO[]> {
    return this.registries.participants();
  }

  @Query(() => [ReportsSubjectDTO], {
    name: 'reportsSubjects',
    description: 'Стол бухгалтера: имена и вид субъектов операций по учётным именам',
  })
  @RequireRight('Registry', 'read')
  async reportsSubjects(@Args('usernames', { type: () => [String] }) usernames: string[]): Promise<ReportsSubjectDTO[]> {
    return this.registries.subjects(usernames);
  }

  @Query(() => [ReportsParticipantWalletDTO], {
    name: 'reportsParticipantWallets',
    description: 'Стол бухгалтера: кошельки пайщиков по программам кооператива',
  })
  @RequireRight('Registry', 'read')
  async reportsParticipantWallets(@Args('coopname', { type: () => String }) coopname: string): Promise<ReportsParticipantWalletDTO[]> {
    return this.registries.participantWallets(coopname);
  }
}
