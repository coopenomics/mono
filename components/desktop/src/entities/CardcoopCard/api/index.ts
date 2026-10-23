import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type { ICardcoopCard } from '../model/types';

/**
 * Запрашивает карту кооператора в сети «Карта кооператора» (story 7.4).
 *
 * Запрос всегда о себе: пайщика сервер берёт из токена — узнать, есть ли карта у соседа,
 * этим маршрутом нельзя.
 */
async function loadMyCard(): Promise<ICardcoopCard> {
  const { [Queries.Cardcoop.GetMyCard.name]: output } = await client.Query(
    Queries.Cardcoop.GetMyCard.query,
    { variables: {} }
  );
  return output as ICardcoopCard;
}

export const api = {
  loadMyCard,
};
