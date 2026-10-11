import type { Queries, Zeus } from '@coopenomics/sdk';

/** Визит на участок по отсканированному коду: кто пришёл и какие дела у него здесь. */
export type MarketplaceScanVisitView = Queries.Marketplace.ResolveScan.IOutput[typeof Queries.Marketplace.ResolveScan.name];
export type MarketplaceScanMatterView = MarketplaceScanVisitView['matters'][number];
export type IResolveScanInput = Queries.Marketplace.ResolveScan.IInput['data'];

/** Код передачи пайщика, выданный сервером. */
export type MarketplaceHandoffCodeView = Queries.Marketplace.HandoffCode.IOutput[typeof Queries.Marketplace.HandoffCode.name];
export type IHandoffCodeInput = Queries.Marketplace.HandoffCode.IInput['data'];

export type MarketplaceScanTarget = Zeus.MarketplaceScanTarget;
export type MarketplaceScanMatterKind = Zeus.MarketplaceScanMatterKind;
