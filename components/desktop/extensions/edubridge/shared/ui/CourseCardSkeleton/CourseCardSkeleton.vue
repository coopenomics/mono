<template lang="pug">
//- Каркас карточки курса: те же обложка 16:9, строки и блок взносов, что у
//- настоящей карточки, — при появлении данных сетка не перестраивается.
.edu-course-skel(aria-hidden="true")
  .skel.edu-course-skel__media
  .edu-course-skel__body
    .skel.skel--text.edu-course-skel__eyebrow
    .skel.skel--title.edu-course-skel__title
    .skel.skel--text.edu-course-skel__fact
    .skel.skel--text.edu-course-skel__fact.edu-course-skel__fact--short
    .edu-course-skel__fees
      .skel.skel--num.edu-course-skel__fee
      .skel.skel--num.edu-course-skel__fee
</template>

<style scoped>
.edu-course-skel {
  height: 100%;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
  overflow: hidden;
}
.edu-course-skel__media {
  aspect-ratio: 16 / 9;
  border-radius: 0;
}
.edu-course-skel__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4) var(--p-5) var(--p-5);
}
.edu-course-skel__eyebrow {
  width: 45%;
}
.edu-course-skel__title {
  width: 75%;
}
.edu-course-skel__fact {
  width: 60%;
}
.edu-course-skel__fact--short {
  width: 40%;
}
.edu-course-skel__fees {
  display: flex;
  gap: var(--p-6);
  margin-top: var(--p-2);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.edu-course-skel__fee {
  width: 35%;
}
</style>
