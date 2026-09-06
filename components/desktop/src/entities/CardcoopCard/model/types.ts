import type { Queries } from '@coopenomics/sdk';

/** Карта кооператора глазами кооператива (story 7.4, FR-E4). */
export type ICardcoopCard = Queries.Cardcoop.GetMyCard.IOutput[typeof Queries.Cardcoop.GetMyCard.name];
