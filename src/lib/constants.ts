export const CATEGORIES = ['mixed', 'construction', 'burning', 'drain', 'dead_animal', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ['reported', 'acknowledged', 'cleared'] as const;
export type Status = (typeof STATUSES)[number];

export const ZONES = ['West', 'North', 'South', 'East'] as const;
export type Zone = (typeof ZONES)[number];

export const RANCHI_CENTRE = { lat: 23.3441, lng: 85.3096 };
/** Reports further than this from the centre are rejected as outside RMC limits. */
export const MAX_DISTANCE_FROM_CENTRE_M = 30000;
export const DUPLICATE_RADIUS_M = 30;
export const MAX_NOTE_LENGTH = 280;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Confirmations from people other than the reporter needed before a report is Verified and sent to officials. */
export const VERIFY_CONFIRMATIONS = Number(process.env.VERIFY_CONFIRMATIONS) || 3;
/** Confirming, marking clean, or saying "still dirty" requires the person's location within this distance. */
export const VERIFY_RADIUS_M = 250;
/** "Still dirty" votes from different people needed to reopen a report marked clean. */
export const REOPEN_THRESHOLD = 2;
