/**
 * Ссылки на соцсети в футере (полные URL, https://...).
 * Либо впишите ниже, либо задайте при сборке: REACT_APP_FOOTER_YOUTUBE, REACT_APP_FOOTER_INSTAGRAM.
 * Пустая строка — ссылка скрыта.
 */
const MANUAL_YOUTUBE = '';
const MANUAL_INSTAGRAM = '';

export const FOOTER_SOCIAL_YOUTUBE =
  (typeof process !== 'undefined' && process.env.REACT_APP_FOOTER_YOUTUBE) || MANUAL_YOUTUBE;
export const FOOTER_SOCIAL_INSTAGRAM =
  (typeof process !== 'undefined' && process.env.REACT_APP_FOOTER_INSTAGRAM) || MANUAL_INSTAGRAM;
