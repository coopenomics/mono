import { defineStore } from 'pinia';
import { ref, Ref } from 'vue';
import { api } from '../api';
import type { ISecretaryRoom, ICreateSecretaryRoomInput } from './types';

const namespace = 'secretaryRoomStore';

interface ISecretaryRoomStore {
  rooms: Ref<ISecretaryRoom[]>;
  isLoading: Ref<boolean>;
  isMutating: Ref<boolean>;
  error: Ref<string | null>;
  loadRooms: () => Promise<ISecretaryRoom[]>;
  createRoom: (data: ICreateSecretaryRoomInput) => Promise<ISecretaryRoom>;
  removeRoom: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSecretaryRoomStore = defineStore(namespace, (): ISecretaryRoomStore => {
  const rooms = ref<ISecretaryRoom[]>([]);
  const isLoading = ref(false);
  const isMutating = ref(false);
  const error = ref<string | null>(null);

  const loadRooms = async (): Promise<ISecretaryRoom[]> => {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await api.listSecretaryRooms();
      rooms.value = result;
      return result;
    } catch (err) {
      console.error('Failed to load secretary rooms:', err);
      error.value = 'Не удалось загрузить список комнат. Попробуйте обновить страницу.';
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  const createRoom = async (data: ICreateSecretaryRoomInput): Promise<ISecretaryRoom> => {
    isMutating.value = true;
    error.value = null;
    try {
      const room = await api.createSecretaryRoom(data);
      await loadRooms();
      return room;
    } finally {
      isMutating.value = false;
    }
  };

  const removeRoom = async (id: string): Promise<void> => {
    isMutating.value = true;
    error.value = null;
    try {
      await api.removeSecretaryRoom(id);
      await loadRooms();
    } finally {
      isMutating.value = false;
    }
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    rooms,
    isLoading,
    isMutating,
    error,
    loadRooms,
    createRoom,
    removeRoom,
    clearError,
  };
});
