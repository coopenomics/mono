import type { Queries, Mutations } from '@coopenomics/sdk';

/** Комната из реестра ChatCoop (системная / проектная / секретаря) */
export type ISecretaryRoom =
  Queries.ChatCoop.ListSecretaryRooms.IOutput[typeof Queries.ChatCoop.ListSecretaryRooms.name][number];

/** Вход для создания комнаты секретаря */
export type ICreateSecretaryRoomInput = Mutations.ChatCoop.CreateSecretaryRoom.IInput['data'];
