<template lang="pug">
EduStubPage(
  storage-key="member-learners"
  icon="family_restroom"
  hint="Ваши обучающиеся — вы или ваши дети — и их курсы. Здесь видно состояние доступа и срок оплаченного периода."
  title="Обучающихся пока нет"
  body="Добавьте обучающегося и выберите курс."
)
</template>

<script setup lang="ts">
import { EduStubPage } from '../../shared/ui/EduStubPage';
</script>
