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
export const VERIFY_CONFIRMATIONS = Number(process.env.VERIFY_CONFIRMATIONS) || 1;
/** Confirming, marking clean, or saying "still dirty" requires the person's location within this distance. */
export const VERIFY_RADIUS_M = 250;
/** "Still dirty" votes from different people needed to reopen a report marked clean. */
export const REOPEN_THRESHOLD = 2;

/**
 * What happens while a verified complaint stays uncleared, counted in days since it was first sent (verified).
 * Each step fires once. Reminders go again to everyone already contacted; senior officials come from
 * data/wards.json "escalation".
 */
export type NotifyRole = 'rmc' | 'councillor' | 'commissioner' | 'sdo' | 'dc';
export const ESCALATION_STEPS = [
  { step: 'reminder1', day: 3, label: 'Reminder 1', roles: ['rmc', 'councillor'] },
  { step: 'reminder2', day: 7, label: 'Reminder 2', roles: ['rmc', 'councillor'] },
  { step: 'commissioner', day: 15, label: 'Escalated to the Municipal Commissioner', roles: ['commissioner'] },
  { step: 'reminder3', day: 21, label: 'Reminder 3', roles: ['rmc', 'councillor', 'commissioner'] },
  { step: 'sdo_dc', day: 30, label: 'Escalated to the SDO and Deputy Commissioner', roles: ['sdo', 'dc'] },
] as const satisfies readonly { step: string; day: number; label: string; roles: readonly NotifyRole[] }[];
export type EscalationStep = (typeof ESCALATION_STEPS)[number]['step'];
