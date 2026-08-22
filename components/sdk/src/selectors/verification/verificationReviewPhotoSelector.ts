import { Selector } from '../../zeus/index'

/** Снимок сверки: короткоживущая ссылка для экрана проверки советом. */
export const verificationReviewPhotoSelector = Selector('VerificationReviewPhoto')({
  storage_key: true,
  mime_type: true,
  size_bytes: true,
  read_url: true,
})
