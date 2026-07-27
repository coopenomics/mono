import type { MarketplaceReturnClaimDomainEntity } from '../../domain/entities/marketplace-return-claim.entity';
import type {
  MarketplaceReturnClaimDecisionLogEntry,
  MarketplaceReturnClaimOnSiteInspection,
  MarketplaceReturnClaimPhoto,
} from '../../domain/entities/marketplace-return-claim.types';
import type {
  MarketplaceReturnClaimDTO,
  MarketplaceReturnClaimDecisionEntryDTO,
  MarketplaceReturnClaimLedgerSnapshotDTO,
  MarketplaceReturnClaimOnSiteInspectionDTO,
  MarketplaceReturnClaimPhotoDTO,
} from '../dto/marketplace-return-claim.dto';
import type { MarketplaceUnitOfMeasureEnum } from '../dto/marketplace-offer.dto';

/**
 * Преобразование domain → GraphQL DTO. Подписанные URL фотографий запрашиваются
 * у переданного `urlResolver` (имплементация знает про bucket file-storage —
 * resolver просто проксирует на `MarketplaceReturnClaimService.getPhotoReadUrl`).
 */
export interface MarketplaceReturnClaimDisplayFields {
  product_name?: string | null;
  unit_of_measure?: MarketplaceUnitOfMeasureEnum | null;
  package_size?: number | null;
  orderer_name?: string | null;
  warranty_until?: Date | null;
}

export async function toMarketplaceReturnClaimDTO(
  claim: MarketplaceReturnClaimDomainEntity,
  urlResolver: (bucket_key: string) => Promise<string>,
  display?: MarketplaceReturnClaimDisplayFields
): Promise<MarketplaceReturnClaimDTO> {
  const photos = await Promise.all(claim.photos.map((p) => toPhotoDTO(p, urlResolver)));
  const inspection = claim.on_site_inspection
    ? await toInspectionDTO(claim.on_site_inspection, urlResolver)
    : null;

  return {
    id: claim.id,
    coopname: claim.coopname,
    request_hash: claim.request_hash,
    order_id: claim.order_id,
    order_hash: claim.order_hash,
    product_name: display?.product_name ?? null,
    unit_of_measure: display?.unit_of_measure ?? null,
    package_size: display?.package_size ?? null,
    orderer_account: claim.orderer_account,
    orderer_name: display?.orderer_name ?? null,
    warranty_until: display?.warranty_until ?? null,
    delivery_braname: claim.delivery_braname,
    supplier_account: claim.supplier_account,
    status: claim.status,
    reason_text: claim.reason_text,
    defect_category: claim.defect_category,
    expected_resolution: claim.expected_resolution,
    actual_quantity: claim.actual_quantity,
    fact_cost: claim.fact_cost,
    fee_refund: claim.fee_refund,
    // Полная сумма возврата — то, что пайщик реально получит обратно; считаем
    // здесь, чтобы каждый клиент не складывал две суммы самостоятельно.
    total_refund: (
      Number.parseFloat(claim.fact_cost) + Number.parseFloat(claim.fee_refund)
    ).toFixed(4),
    photos,
    submretrn_tx_hash: claim.submretrn_tx_hash,
    decision_log: claim.decision_log.map(toDecisionEntryDTO),
    on_site_inspection: inspection,
    ledger_snapshot: claim.ledger_snapshot ? toLedgerSnapshotDTO(claim.ledger_snapshot) : null,
    created_at: claim.created_at,
    updated_at: claim.updated_at,
  };
}

async function toPhotoDTO(
  photo: MarketplaceReturnClaimPhoto,
  urlResolver: (bucket_key: string) => Promise<string>
): Promise<MarketplaceReturnClaimPhotoDTO> {
  const url = await urlResolver(photo.bucket_key);
  return {
    url,
    content_hash: photo.content_hash,
    mime_type: photo.mime_type,
    // photos лежит в jsonb-колонке, поэтому из БД дата приходит ISO-строкой;
    // кастомный DateTime-скаляр сериализует только Date — регидратируем.
    uploaded_at: new Date(photo.uploaded_at),
  };
}

function toDecisionEntryDTO(
  entry: MarketplaceReturnClaimDecisionLogEntry
): MarketplaceReturnClaimDecisionEntryDTO {
  return {
    stage: entry.stage,
    decision: entry.decision,
    by_chairman_account: entry.by_chairman_account,
    braname: entry.braname,
    comment: entry.comment,
    at: new Date(entry.at),
    tx_hash: entry.tx_hash,
  };
}

async function toInspectionDTO(
  inspection: MarketplaceReturnClaimOnSiteInspection,
  urlResolver: (bucket_key: string) => Promise<string>
): Promise<MarketplaceReturnClaimOnSiteInspectionDTO> {
  const photos = await Promise.all(inspection.photos.map((p) => toPhotoDTO(p, urlResolver)));
  return {
    result_text: inspection.result_text,
    photos,
    scanned_barcode: inspection.scanned_barcode ?? undefined,
    by_chairman_account: inspection.by_chairman_account,
    at: new Date(inspection.at),
  };
}

function toLedgerSnapshotDTO(
  s: NonNullable<MarketplaceReturnClaimDomainEntity['ledger_snapshot']>
): MarketplaceReturnClaimLedgerSnapshotDTO {
  return {
    amount: s.amount,
    returned_quantity: s.returned_quantity,
    tx_hash: s.tx_hash,
    at: new Date(s.at),
  };
}
