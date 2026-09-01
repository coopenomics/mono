import {
  useStoryStore,
  type IDeleteStoryInput,
  type IDeleteStoryOutput,
} from 'app/extensions/capital/entities/Story/model';
import { useFavoritesStore } from 'app/extensions/capital/entities/Favorite';
import { api } from '../api';

export function useDeleteStory() {
  const store = useStoryStore();
  const favoritesStore = useFavoritesStore();

  async function deleteStory(
    data: IDeleteStoryInput,
  ): Promise<IDeleteStoryOutput> {
    const result = await api.deleteStory(data);

    if (result) {
      store.removeStoryFromList(data.story_hash);
      favoritesStore.dropTarget(data.story_hash);
    }

    return result;
  }

  return { deleteStory };
}
