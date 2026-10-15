<template lang="pug">
q-btn(
  color='primary',
  @click='handleCreateStory',
  :loading='loading',
  :label='$t("capital.createStoryButton.label")'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCreateStory } from '../model';
import { FailAlert } from 'src/shared/api/alerts';

const { createStory, createStoryInput } = useCreateStory();
const loading = ref(false);

const handleCreateStory = async () => {
  loading.value = true;
  try {
    await createStory(createStoryInput.value);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
