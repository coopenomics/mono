import { client } from 'src/shared/api/client';
import { Queries, Mutations } from '@coopenomics/sdk';
import type { ISecretaryRoom, ICreateSecretaryRoomInput } from '../model/types';

async function listSecretaryRooms(): Promise<ISecretaryRoom[]> {
  const { [Queries.ChatCoop.ListSecretaryRooms.name]: rows } = await client.Query(
    Queries.ChatCoop.ListSecretaryRooms.query,
    {},
  );
  return rows ?? [];
}

async function createSecretaryRoom(data: ICreateSecretaryRoomInput): Promise<ISecretaryRoom> {
  const { [Mutations.ChatCoop.CreateSecretaryRoom.name]: row } = await client.Mutation(
    Mutations.ChatCoop.CreateSecretaryRoom.mutation,
    { variables: { data } },
  );
  return row;
}

async function removeSecretaryRoom(id: string): Promise<string> {
  const { [Mutations.ChatCoop.RemoveSecretaryRoom.name]: result } = await client.Mutation(
    Mutations.ChatCoop.RemoveSecretaryRoom.mutation,
    { variables: { data: { id } } },
  );
  return result;
}

export const api = {
  listSecretaryRooms,
  createSecretaryRoom,
  removeSecretaryRoom,
};
