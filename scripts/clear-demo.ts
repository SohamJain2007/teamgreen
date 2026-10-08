/** Deletes every demo report and its photos: `npm run demo:clear`. Real reports are never touched. */
import { clearDemo } from '../src/lib/reports';

clearDemo().then((n) => console.log(`removed ${n} demo report(s)`));
