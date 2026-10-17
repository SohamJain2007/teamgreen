// Translation keys that depend on a report's type. Plain functions so both server pages and client components can use them.
import type { ReportType, Status } from './constants';
import type { Key } from './translations';

/** "Cleared" reads "Repaired" for a pothole and "Action taken" for tree cutting. */
export const statusKey = (status: Status, type: ReportType = 'garbage'): Key =>
  status === 'cleared' && type !== 'garbage' ? `status.cleared.${type}` : `status.${status}`;

/** Title of a report with no category: "Garbage spot", "Pothole", "Tree cutting". */
export const titleKey = (type: ReportType = 'garbage'): Key => (type === 'garbage' ? 'r.title' : `r.title.${type}`);
