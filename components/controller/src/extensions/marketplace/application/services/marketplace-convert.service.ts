import { Inject, Injectable } from '@nestjs/common';
import { type MarketContract } from 'cooptypes';
import { Registry } from '@coopenomics/docs-templates';
import { PublicKey, Signature } from '@wharfkit/antelope';
import {
  DOCUMENT_PORT,
  USER_WALLET_PORT,
  type IDocumentPort,
  type InnerGeneratedDocument,
  type IUserWalletPort,
} from '@coopenomics/innercoop';
import { SignedDigitalDocumentInputDTO, DomainError } from '@coopenomics/extension-kit';
import type { MarketplaceConvertStatementSignedInputDTO } from '../documents-dto/marketplace-convert-statement-document.dto';
import { MARKETPLACE_ASSET_CONFIG, type MarketplaceAssetConfig } from './marketplace-asset.config';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';

export const MARKETPLACE_CONVERT_SERVICE = Symbol('MARKETPLACE_CONVERT_SERVICE');

/** Главный паевой кошелёк ЦК — источник трансляции в Стол заказов. */
export const MAIN_SHARE_WALLET = 'w.wal.share';
/** Свободный паевой «Стола заказов» — источник обеспечительной части и тела заказа. */
export const MARKETPLACE_SHARE_WALLET = 'w.mkt.share';
/** Обеспечительная часть паевого взноса к списанию в членский взнос по условиям ЦПП (задача 99D-18). */
export const MARKETPLACE_DUE_WALLET = 'w.mkt.due';

export type ConvertStatementDocument = MarketContract.Actions.Convert.IConvert['convert_statement'];

/** Строка к фондированию: тело и обеспечительная часть в минимальных единицах. */
export interface FundingLineInput {
  body_units: bigint;
  fee_units: bigint;
}

/**
 * Как контракт разложит строку (задача 99D-18): обеспечительная часть — со
 * свободного паевого «Стола заказов», тело — с его остатка; чего не хватило,
 * пайщик транслирует с Цифрового кошелька заявлением 1110.
 */
export interface FundingLinePlan extends FundingLineInput {
  /** Часть обеспечительной части, покрытая свободным паевым «Стола заказов». */
  fee_program_units: bigint;
  /** Недостающая часть обеспечительной части — транслируется с Цифрового кошелька. */
  fee_convert_units: bigint;
  /** Часть тела, покрытая свободным паевым «Стола заказов» (o.mkt.lockp). */
  body_program_units: bigint;
  /** Недостающая часть тела — транслируется с Цифрового кошелька. */
  body_wallet_units: bigint;
  /** Трансляция под эту строку: недостающие части тела и обеспечительной части. */
  translate_units: bigint;
}

export interface FundingPlan {
  lines: FundingLinePlan[];
  /** Обеспечительная часть в сумме трансляции (все строки). */
  fee_convert_units: bigint;
  /** Тела в сумме трансляции (все строки). */
  body_wallet_units: bigint;
  /** Сумма заявления — всё, что транслируется с Цифрового кошелька. */
  transfer_units: bigint;
}

/**
 * Заявление 1110 о трансляции паевого взноса из ЦПП «Цифровой Кошелёк» в ЦПП
 * «Стол заказов» (задача 99D-18, решение владельца 31.10.2026). Всё, что
 * пайщик вносит под заказ, — паевой взнос: тело и обеспечительная часть по
 * ставке кооператива. Оба идут со свободного паевого «Стола заказов»
 * `w.mkt.share`: сначала обеспечительная часть (контракт берёт её только с
 * этого кошелька целиком), затем тело. Заявление пишется только на то, чего на нём не
 * хватило; действие `convert` транслирует эту сумму на `w.mkt.share` первым в
 * транзакции оформления. Контракт раскладывает суммы сам по балансам на момент
 * действия — здесь тот же расчёт для превью и сверки подписанных мет.
 */
@Injectable()
export class MarketplaceConvertService {
  constructor(
    @Inject(USER_WALLET_PORT) private readonly walletRepo: IUserWalletPort,
    @Inject(DOCUMENT_PORT) private readonly documentPort: IDocumentPort,
    @Inject(MARKETPLACE_ECONOMY_SERVICE) private readonly economyService: MarketplaceEconomyService,
    @Inject(MARKETPLACE_ASSET_CONFIG) private readonly assetConfig: MarketplaceAssetConfig
  ) {}

  /** available кошелька пайщика в минимальных единицах валюты (нет строки — 0). */
  async availableUnits(coopname: string, username: string, wallet_name: string): Promise<bigint> {
    const rows = await this.walletRepo.findByUsername(coopname, username);
    const row = rows.find((r) => r.wallet_name === wallet_name);
    return row?.available ? this.economyService.assetToUnits(String(row.available)) : 0n;
  }

  /** Остаток свободного паевого «Стола заказов» — покрывает обеспечительную часть и тела заказов. */
  async programBalances(coopname: string, username: string): Promise<{ share: bigint }> {
    return { share: await this.availableUnits(coopname, username, MARKETPLACE_SHARE_WALLET) };
  }

  /**
   * План по строкам в порядке проведения (тот же, что в контракте): по каждой
   * строке со свободного паевого сначала обеспечительная часть, затем тело;
   * нехватка каждой части транслируется с Цифрового кошелька по заявлению.
   * Остаток тянется между строками последовательно.
   */
  planFunding(balances: { share: bigint }, lines: ReadonlyArray<FundingLineInput>): FundingPlan {
    let share = balances.share > 0n ? balances.share : 0n;
    const planned: FundingLinePlan[] = lines.map((line) => {
      const fee_program_units = line.fee_units > share ? share : line.fee_units;
      share -= fee_program_units;
      const body_program_units = line.body_units > share ? share : line.body_units;
      share -= body_program_units;
      const fee_convert_units = line.fee_units - fee_program_units;
      const body_wallet_units = line.body_units - body_program_units;
      return {
        ...line,
        fee_program_units,
        fee_convert_units,
        body_program_units,
        body_wallet_units,
        translate_units: fee_convert_units + body_wallet_units,
      };
    });
    const fee_convert_units = planned.reduce((s, l) => s + l.fee_convert_units, 0n);
    const body_wallet_units = planned.reduce((s, l) => s + l.body_wallet_units, 0n);
    return { lines: planned, fee_convert_units, body_wallet_units, transfer_units: body_wallet_units + fee_convert_units };
  }

  /** Заявление 1110 к подписи: сумма трансляции и обеспечительная часть в ней. */
  async generateStatement(input: {
    coopname: string;
    username: string;
    /** Якорь: хеш оформления, бандла либо заказа. */
    anchor_hash: string;
    /** Сумма заявления — недостающая часть тела и обеспечительной части. */
    amount_units: bigint;
    /** Обеспечительная часть в сумме трансляции (в текст заявления не выводится). */
    fee_units: bigint;
  }): Promise<InnerGeneratedDocument> {
    const action: Registry.MarketplaceConvertStatement.Action = {
      registry_id: Registry.MarketplaceConvertStatement.registry_id,
      coopname: input.coopname,
      username: input.username,
      lang: 'ru',
      order_hash: input.anchor_hash,
      amount: this.economyService.unitsToAsset(input.amount_units),
      membership_fee: this.economyService.unitsToAsset(input.fee_units),
      // Тело сохраняется в стор: реестр документов пересобирает агрегат по doc_hash.
      skip_save: false,
    };
    return this.documentPort.generate({ data: action });
  }

  /**
   * Проверка подписанного заявления перед отправкой в цепь: тот же якорь,
   * та же сумма трансляции и обеспечительная часть в ней (баланс кошелька мог
   * измениться с превью), подпись пайщика верна. Возвращает document2 для контракта.
   */
  verifySigned(
    signed: MarketplaceConvertStatementSignedInputDTO | null | undefined,
    expected: { anchor_hash: string; amount_units: bigint; fee_units: bigint },
    signer: string
  ): ConvertStatementDocument {
    if (!signed) {
      throw DomainError.badRequest('MARKETPLACE_CONVERT_STATEMENT_MISSING', { expectedAmount: this.economyService.unitsToAsset(expected.amount_units) });
    }
    const meta = signed.meta;
    if (
      meta.registry_id !== Registry.MarketplaceConvertStatement.registry_id ||
      meta.order_hash !== expected.anchor_hash
    ) {
      throw DomainError.badRequest('MARKETPLACE_CONVERT_STATEMENT_WRONG_CHECKOUT');
    }
    if (this.economyService.assetToUnits(String(meta.amount)) !== expected.amount_units) {
      throw DomainError.badRequest('MARKETPLACE_CONVERT_AMOUNT_CHANGED', { statementAmount: meta.amount, expectedAmount: this.economyService.unitsToAsset(expected.amount_units) });
    }
    if (this.economyService.assetToUnits(String(meta.membership_fee)) !== expected.fee_units) {
      throw DomainError.badRequest('MARKETPLACE_CONVERT_FEE_CHANGED', { statementFee: meta.membership_fee, expectedFee: this.economyService.unitsToAsset(expected.fee_units) });
    }
    this.verifySignature(signed, signer);
    return new SignedDigitalDocumentInputDTO(signed).toDocument() as ConvertStatementDocument;
  }

  private verifySignature(
    doc: { signatures: Array<{ signer: string; public_key: string; signature: string; signed_hash: string }> },
    expectedSigner: string
  ): void {
    const signatures = doc.signatures ?? [];
    if (!signatures.some((s) => s.signer === expectedSigner)) {
      throw DomainError.forbidden('MARKETPLACE_CONVERT_WRONG_SIGNER', { expectedSigner });
    }
    for (const sig of signatures) {
      let ok = false;
      try {
        ok = Signature.from(sig.signature).verifyDigest(sig.signed_hash, PublicKey.from(sig.public_key));
      } catch {
        ok = false;
      }
      if (!ok) {
        throw DomainError.forbidden('MARKETPLACE_CONVERT_SIGNATURE_INVALID');
      }
    }
  }
}
