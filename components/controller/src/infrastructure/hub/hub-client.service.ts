import { Injectable, Logger } from '@nestjs/common';
import { Client, Mutations, Queries } from '@coopenomics/sdk';
import { Inject } from '@nestjs/common';
import { VaultDomainService } from '~/domain/vault/services/vault-domain.service';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { config } from '~/config';

/**
 * Публичные сведения о кооперативе-операторе (хабе) для текста заявления.
 */
export interface HubPublicInfoDomainInterface {
  coopname: string;
  full_name: string;
  details_text: string; // ИНН/ОГРН и контакты текстом
}

/**
 * Счёт на пополнение главного кошелька организации на хабе:
 * реквизиты получателя и назначение платежа для кассира.
 */
export interface HubDepositInvoiceDomainInterface {
  hash: string;
  details_text: string;
  memo: string;
  expired_at: Date | null;
}

/**
 * Баланс программного кошелька организации на хабе.
 */
export interface HubProgramWalletDomainInterface {
  program_id: string;
  program_type: string | null;
  available: string;
  blocked: string;
  membership_contribution: string;
}

/**
 * Клиент бэкенда кооператива-оператора платформы (хаба).
 *
 * Данный кооператив («спица») подключён к оператору как пайщик-юрлицо:
 * username организации на хабе совпадает с coopname спицы, а приватный ключ
 * организации — это ключ кооператива из vault. Поэтому бэкенд спицы способен
 * самостоятельно авторизоваться на хабе (client.login(email, wif)) и выполнять
 * действия от имени организации: создавать счёт на пополнение главного
 * кошелька и читать балансы программных кошельков.
 *
 * WIF читается из vault только на время логина и не сохраняется в полях.
 * Токен доступа хаба кэшируется в памяти процесса и не персистится.
 */
@Injectable()
export class HubClientService {
  private readonly logger = new Logger(HubClientService.name);

  private accessToken: string | null = null;
  private tokenObtainedAt = 0;
  /** Перелогин не чаще, чем раз в 10 минут — access-токен живёт дольше. */
  private static readonly TOKEN_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly vaultDomainService: VaultDomainService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository
  ) {}

  isConfigured(): boolean {
    return Boolean(config.hub.backend_url);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Связь с кооперативом-оператором не настроена (HUB_BACKEND_URL не задан)');
    }
  }

  private createClient(): ReturnType<typeof Client.create> {
    this.assertConfigured();
    return Client.create({
      api_url: `${config.hub.backend_url}/v1/graphql`,
      chain_url: config.blockchain.url,
      chain_id: config.blockchain.id,
    });
  }

  private async createAuthorizedClient(): Promise<ReturnType<typeof Client.create>> {
    const client = this.createClient();

    const email = await this.resolveLoginEmail();
    const wif = await this.vaultDomainService.getWif(config.coopname);
    if (!wif) {
      throw new Error('Приватный ключ кооператива недоступен в vault — авторизация на бэкенде оператора невозможна');
    }

    await client.login(email, wif);
    return client;
  }

  private async resolveLoginEmail(): Promise<string> {
    if (config.hub.login_email) return config.hub.login_email;

    const orgUser = await this.userRepository.findByUsername(config.coopname);
    if (!orgUser?.email) {
      throw new Error(
        'Email организации для логина на бэкенде оператора не найден: задайте HUB_LOGIN_EMAIL или email организации'
      );
    }
    return orgUser.email;
  }

  /**
   * Публичные сведения об операторе (без авторизации) — для текста заявления.
   */
  async getPublicInfo(): Promise<HubPublicInfoDomainInterface> {
    const client = this.createClient();

    const { [Queries.System.GetSystemInfo.name]: info } = await client.Query(Queries.System.GetSystemInfo.query, {
      variables: {},
    });

    const contacts = info?.contacts;
    const detailsParts: string[] = [];
    if (contacts?.full_name) detailsParts.push(`Получатель: ${contacts.full_name}`);
    if (contacts?.details?.inn) detailsParts.push(`ИНН: ${contacts.details.inn}`);
    if (contacts?.details?.ogrn) detailsParts.push(`ОГРН: ${contacts.details.ogrn}`);
    if (contacts?.full_address) detailsParts.push(`Адрес: ${contacts.full_address}`);
    if (contacts?.email) detailsParts.push(`Email: ${contacts.email}`);

    return {
      coopname: info?.coopname ?? config.hub.coopname,
      full_name: contacts?.full_name ?? config.hub.coopname,
      details_text:
        detailsParts.length > 0
          ? detailsParts.join('\n')
          : `Получатель: кооператив-оператор «${config.hub.coopname}»`,
    };
  }

  /**
   * Создать на хабе счёт на пополнение главного кошелька организации
   * (паевой взнос по ЦПП «Цифровой Кошелёк») и вернуть реквизиты с
   * назначением платежа для кассира.
   */
  async createDepositInvoice(quantity: number, symbol: string): Promise<HubDepositInvoiceDomainInterface> {
    const client = await this.createAuthorizedClient();

    const { [Mutations.Wallet.CreateDepositPayment.name]: payment } = await client.Mutation(
      Mutations.Wallet.CreateDepositPayment.mutation,
      {
        variables: {
          data: {
            quantity,
            symbol,
            username: config.coopname,
          },
        },
      }
    );

    const detailsData = payment?.payment_details?.data;
    const detailsText =
      typeof detailsData === 'string' ? detailsData : detailsData ? JSON.stringify(detailsData, null, 2) : '';

    return {
      hash: payment?.hash ?? '',
      details_text: detailsText,
      memo: payment?.memo || `Паевой взнос по ЦПП «Цифровой Кошелёк» №${(payment?.hash ?? '').slice(0, 8)}`,
      expired_at: payment?.expired_at ? new Date(String(payment.expired_at)) : null,
    };
  }

  /**
   * Балансы программных кошельков организации на хабе
   * (главный кошелёк + программные, включая ЦПП оператора).
   */
  async getProgramWallets(): Promise<HubProgramWalletDomainInterface[]> {
    const client = await this.createAuthorizedClient();

    const { [Queries.Wallet.GetProgramWallets.name]: result } = await client.Query(
      Queries.Wallet.GetProgramWallets.query,
      {
        variables: {
          filter: { coopname: config.hub.coopname, username: config.coopname },
          options: { page: 1, limit: 100 },
        },
      }
    );

    const items = result?.items ?? [];
    return items.map((item: any) => ({
      program_id: String(item.program_id),
      program_type: item.program_type ?? null,
      available: String(item.available ?? ''),
      blocked: String(item.blocked ?? ''),
      membership_contribution: String(item.membership_contribution ?? ''),
    }));
  }
}
