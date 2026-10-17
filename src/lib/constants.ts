/** What a report is about. Each type has its own categories, officials and escalation (see PLANS). */
export const REPORT_TYPES = ['garbage', 'pothole', 'tree'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const CATEGORIES_BY_TYPE = {
  garbage: ['mixed', 'construction', 'burning', 'drain', 'dead_animal', 'other'],
  pothole: ['pothole', 'road_broken', 'manhole', 'waterlogging'],
  tree: ['tree_cutting', 'tree_cut', 'tree_lopping', 'tree_damage'],
} as const;
export const CATEGORIES = [...CATEGORIES_BY_TYPE.garbage, ...CATEGORIES_BY_TYPE.pothole, ...CATEGORIES_BY_TYPE.tree] as const;
export type Category = (typeof CATEGORIES)[number];
export const categoriesOf = (type: ReportType): readonly Category[] => CATEGORIES_BY_TYPE[type];

/**
 * Who owns the road decides who fixes a pothole, and GPS cannot tell, so the reporter picks one:
 * lane: colony / municipal road (RMC), main: state highway or major road (Road Construction Department, Road Division Ranchi),
 * highway: national highway or bypass (RCD National Highway Division Ranchi).
 */
export const ROADS = ['lane', 'main', 'highway'] as const;
export type Road = (typeof ROADS)[number];

export const STATUSES = ['reported', 'acknowledged', 'cleared'] as const;
export type Status = (typeof STATUSES)[number];

export const ZONES = ['West', 'North', 'South', 'East'] as const;
export type Zone = (typeof ZONES)[number];

export const RANCHI_CENTRE = { lat: 23.3441, lng: 85.3096 };
/** Reports are only taken from people whose phone is within this distance of the centre, for a spot also within it. */
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
/** Senior officials with a contact in data/wards.json "escalation" (editable in /admin → Ward data). */
export const ESCALATION_ROLES = [
  'commissioner', 'sdo', 'dc', // RMC chain
  'rcd_ee', 'rcd_se', 'rcd_ce', // Road Construction Department: Road Division / Road Circle Ranchi, Chief Engineer
  'nh_ee', 'nh_se', 'nh_ce', // RCD National Highway Division / Circle Ranchi, Chief Engineer NH Wing
  'dfo', 'cf', 'pccf', // Forest Department: DFO Ranchi, Conservator of Forests, PCCF & Head of Forest Force
] as const;
export type EscalationRole = (typeof ESCALATION_ROLES)[number];
export type NotifyRole = 'rmc' | 'councillor' | EscalationRole;

/** Which office a report goes to. */
export type Route = 'rmc' | 'rcd' | 'nh' | 'forest';
export function routeOf(r: { type: ReportType; road: Road | null }): Route {
  if (r.type === 'tree') return 'forest';
  if (r.type === 'pothole') return r.road === 'main' ? 'rcd' : r.road === 'highway' ? 'nh' : 'rmc';
  return 'rmc';
}

type Step = { step: string; day: number; label: string; roles: readonly NotifyRole[] };
/** Who gets the complaint once it is verified, and the reminders / escalations while it stays open. */
export const PLANS = {
  rmc: {
    office: 'Ranchi Municipal Corporation and the ward councillor',
    complaint: ['rmc', 'councillor'],
    steps: [
      { step: 'reminder1', day: 3, label: 'Reminder 1', roles: ['rmc', 'councillor'] },
      { step: 'reminder2', day: 7, label: 'Reminder 2', roles: ['rmc', 'councillor'] },
      { step: 'commissioner', day: 15, label: 'Escalated to the Municipal Commissioner', roles: ['commissioner'] },
      { step: 'reminder3', day: 21, label: 'Reminder 3', roles: ['rmc', 'councillor', 'commissioner'] },
      { step: 'sdo_dc', day: 30, label: 'Escalated to the SDO and Deputy Commissioner', roles: ['sdo', 'dc'] },
    ],
  },
  rcd: {
    office: 'the Road Construction Department (Road Division Ranchi) and the ward councillor',
    complaint: ['rcd_ee', 'councillor'],
    steps: [
      { step: 'reminder1', day: 3, label: 'Reminder 1', roles: ['rcd_ee'] },
      { step: 'reminder2', day: 7, label: 'Reminder 2', roles: ['rcd_ee', 'councillor'] },
      { step: 'senior', day: 15, label: 'Escalated to the Superintending Engineer, Road Circle Ranchi', roles: ['rcd_se'] },
      { step: 'reminder3', day: 21, label: 'Reminder 3', roles: ['rcd_ee', 'rcd_se'] },
      { step: 'top', day: 30, label: 'Escalated to the Chief Engineer and the Deputy Commissioner', roles: ['rcd_ce', 'dc'] },
    ],
  },
  nh: {
    office: 'the Road Construction Department (National Highway Division Ranchi)',
    complaint: ['nh_ee'],
    steps: [
      { step: 'reminder1', day: 3, label: 'Reminder 1', roles: ['nh_ee'] },
      { step: 'reminder2', day: 7, label: 'Reminder 2', roles: ['nh_ee'] },
      { step: 'senior', day: 15, label: 'Escalated to the Superintending Engineer, NH Circle Ranchi', roles: ['nh_se'] },
      { step: 'reminder3', day: 21, label: 'Reminder 3', roles: ['nh_ee', 'nh_se'] },
      { step: 'top', day: 30, label: 'Escalated to the Chief Engineer (NH Wing) and the Deputy Commissioner', roles: ['nh_ce', 'dc'] },
    ],
  },
  forest: {
    office: 'the Forest Department (DFO Ranchi) and the ward councillor',
    complaint: ['dfo', 'councillor'],
    steps: [
      { step: 'reminder1', day: 3, label: 'Reminder 1', roles: ['dfo'] },
      { step: 'reminder2', day: 7, label: 'Reminder 2', roles: ['dfo', 'councillor'] },
      { step: 'senior', day: 15, label: 'Escalated to the Conservator of Forests, Ranchi', roles: ['cf'] },
      { step: 'reminder3', day: 21, label: 'Reminder 3', roles: ['dfo', 'cf'] },
      { step: 'top', day: 30, label: 'Escalated to the PCCF & Head of Forest Force and the Deputy Commissioner', roles: ['pccf', 'dc'] },
    ],
  },
} as const satisfies Record<Route, { office: string; complaint: readonly NotifyRole[]; steps: readonly Step[] }>;
/** Kept for the garbage (RMC) plan, which is what older code and data refer to. */
export const ESCALATION_STEPS = PLANS.rmc.steps;
export type EscalationStep = (typeof PLANS)[Route]['steps'][number]['step'];
/** Days of the first reminder, the same for every plan. */
export const FIRST_REMINDER_DAY = 3;
