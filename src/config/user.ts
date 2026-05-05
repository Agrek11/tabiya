/**
 * Single-user app config — placeholder profile until Lichess sync lands.
 *
 * Centralized so sidebar profile / dashboard greeting / progress headers all
 * read the same name. Replace with real auth + profile in Phase 4.
 */

export const USER_NAME = 'Arushi';
export const USER_ELO: number | null = null;
export const USER_INITIAL = USER_NAME.charAt(0).toUpperCase();
