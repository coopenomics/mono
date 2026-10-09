import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REGISTRY_PORT,
  ACCOUNT_PORT,
  PROGRAM_WALLET_PORT,
  type IAccountingRegistryPort,
  type IAccountPort,
  type InnerAccount,
  type IProgramWalletPort,
} from '@coopenomics/innercoop';
import type {
  GetLedger2HistoryInputDTO,
  GetLedger2PostingsInputDTO,
  Ledger2AccountDTO,
  Ledger2HistoryResponseDTO,
  Ledger2PostingsResponseDTO,
  Ledger2WalletDTO,
  PaginationInputDTO,
  PaginationResult,
  ProcessSummaryDTO,
  ProcessViewDTO,
  ProcessesFilterInput,
} from '@coopenomics/extension-kit';
import type { ReportsParticipantDTO, ReportsParticipantWalletDTO, ReportsSubjectDTO } from '../dto/registries.dto';

/** Статус принятого пайщика в записи пайщика цепи. */
const ACCEPTED = 'accepted';
/** Размер страницы при чтении пайщиков и предел страниц: реестр показывает всех принятых. */
const PARTICIPANTS_PAGE = 1000;
const PARTICIPANTS_MAX_PAGES = 50;
/** Сколько субъектов реестр спрашивает за раз: страница реестра не длиннее. */
const SUBJECTS_LIMIT = 200;

/**
 * Реестры Стола бухгалтера (C28-90): счета, кошельки, операции, проводки,
 * процессы и пайщики с их кошельками.
 *
 * Данные ведёт ядро; стол читает их через порты и отдаёт собственными
 * операциями под правом своей таблицы. Личные данные пайщика наружу не
 * уходят: реестрам нужно только имя для показа.
 */
@Injectable()
export class ReportsRegistriesService {
  constructor(
    @Inject(ACCOUNTING_REGISTRY_PORT) private readonly registries: IAccountingRegistryPort,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    @Inject(PROGRAM_WALLET_PORT) private readonly programWallets: IProgramWalletPort
  ) {}

  ledgerAccounts(coopname: string): Promise<Ledger2AccountDTO[]> {
    return this.registries.ledgerAccounts(coopname) as Promise<Ledger2AccountDTO[]>;
  }

  ledgerWallets(coopname: string): Promise<Ledger2WalletDTO[]> {
    return this.registries.ledgerWallets(coopname) as Promise<Ledger2WalletDTO[]>;
  }

  ledgerHistory(input: GetLedger2HistoryInputDTO): Promise<Ledger2HistoryResponseDTO> {
    return this.registries.ledgerHistory(input) as Promise<Ledger2HistoryResponseDTO>;
  }

  ledgerPostings(input: GetLedger2PostingsInputDTO): Promise<Ledger2PostingsResponseDTO> {
    return this.registries.ledgerPostings(input) as Promise<Ledger2PostingsResponseDTO>;
  }

  process(hash: string, coopname: string): Promise<ProcessViewDTO> {
    return this.registries.process(hash, coopname) as Promise<ProcessViewDTO>;
  }

  processes(filter: ProcessesFilterInput, pagination: PaginationInputDTO): Promise<PaginationResult<ProcessSummaryDTO>> {
    return this.registries.processes(filter, pagination) as Promise<PaginationResult<ProcessSummaryDTO>>;
  }

  /** Принятые пайщики: учётное имя и имя для показа. */
  async participants(): Promise<ReportsParticipantDTO[]> {
    const out: ReportsParticipantDTO[] = [];
    for (let page = 1; page <= PARTICIPANTS_MAX_PAGES; page++) {
      const batch = await this.accounts.getAccounts({}, { page, limit: PARTICIPANTS_PAGE, sortOrder: 'DESC' });
      for (const account of batch.items) {
        if (account.participant_account?.status !== ACCEPTED) continue;
        out.push({ username: account.username, name: displayName(account) });
      }
      if (page >= batch.totalPages) break;
    }
    return out;
  }

  /**
   * Имена и вид субъектов операций по учётным именам: в реестрах субъектом
   * бывает пайщик, организация, кооперативный участок и сам кооператив.
   * Неизвестное имя пропускается — реестр покажет учётное имя.
   */
  async subjects(usernames: string[]): Promise<ReportsSubjectDTO[]> {
    const wanted = [...new Set(usernames.filter(Boolean))].slice(0, SUBJECTS_LIMIT);
    const found = await Promise.all(
      wanted.map(async (username): Promise<ReportsSubjectDTO | null> => {
        try {
          const account = await this.accounts.getAccount(username);
          return { username, name: displayName(account), account_kind: String(account.account_kind ?? '') };
        } catch {
          return null;
        }
      })
    );
    return found.filter((subject): subject is ReportsSubjectDTO => subject !== null);
  }

  /** Кошельки пайщиков по программам кооператива. */
  async participantWallets(coopname: string): Promise<ReportsParticipantWalletDTO[]> {
    const wallets = await this.programWallets.getProgramWallets({ coopname });
    return wallets
      .filter((wallet) => wallet.username && wallet.program_id !== undefined)
      .map((wallet) => ({
        username: String(wallet.username),
        program_id: String(wallet.program_id),
        available: String(wallet.available ?? ''),
      }));
  }
}

/** Имя для показа: ФИО физлица и предпринимателя, краткое название организации; иначе учётное имя. */
function displayName(account: InnerAccount): string {
  const data = account.private_account;
  const person = data?.individual_data ?? data?.entrepreneur_data;
  const fio = person ? [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ') : '';
  return fio || String(data?.organization_data?.short_name ?? '') || account.username;
}
