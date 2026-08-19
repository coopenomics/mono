import { defineStore } from 'pinia';
import { computed, ref, type Ref } from 'vue';
import { api } from '../api';
import type { IFavorite, IFavoriteInput, IFavoriteTargetType, IGetFavoritesInput } from './types';

const namespace = 'capitalFavoritesStore';

interface IFavoritesStore {
  favorites: Ref<IFavorite[]>;
  isFavorite: (target_type: IFavoriteTargetType, target_hash: string) => boolean;
  loadFavorites: (filter: IGetFavoritesInput) => Promise<void>;
  toggleFavorite: (data: IFavoriteInput) => Promise<void>;
}

/**
 * Личное избранное пайщика в Благоросте. Один источник для звёздочек
 * в списках, шапках сущностей и суб-пунктов левого меню: мутации
 * возвращают полный список, поэтому все точки синхронны без перезапросов.
 */
export const useFavoritesStore = defineStore(namespace, (): IFavoritesStore => {
  const favorites = ref<IFavorite[]>([]);

  const keys = computed(
    () => new Set(favorites.value.map((f) => `${f.target_type}:${f.target_hash}`)),
  );

  function isFavorite(target_type: IFavoriteTargetType, target_hash: string): boolean {
    return keys.value.has(`${target_type}:${target_hash.toLowerCase()}`);
  }

  async function loadFavorites(filter: IGetFavoritesInput): Promise<void> {
    favorites.value = await api.loadFavorites(filter);
  }

  async function toggleFavorite(data: IFavoriteInput): Promise<void> {
    const normalized = { ...data, target_hash: data.target_hash.toLowerCase() };
    favorites.value = isFavorite(data.target_type, data.target_hash)
      ? await api.removeFavorite(normalized)
      : await api.addFavorite(normalized);
  }

  return { favorites, isFavorite, loadFavorites, toggleFavorite };
});
