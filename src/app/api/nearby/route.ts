import { json, fail } from '@/lib/api';
import { nearbyOpen } from '@/lib/reports';
import { REPORT_TYPES, DUPLICATE_RADIUS_M, type ReportType } from '@/lib/constants';
import { resolveWard } from '@/lib/wards';
import { clientId, rateLimit } from '@/lib/request';

export async function GET(req: Request) {
  if (!rateLimit(`nearby:${clientId(req)}`, 120, 60 * 60 * 1000)) return fail('rate', 429);
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get('lat'));
  const lng = Number(u.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail('bad_location');
  const typeRaw = u.searchParams.get('type');
  const type = typeRaw && (REPORT_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as ReportType) : undefined;
  const res = resolveWard(lat, lng);
  const nearby = nearbyOpen(lat, lng, DUPLICATE_RADIUS_M, type).map(({ report, distanceM }) => ({
    id: report.id,
    thumb: report.thumb,
    category: report.category,
    status: report.status,
    upvotes: report.upvotes,
    createdAt: report.createdAt,
    distanceM: Math.round(distanceM),
  }));
  return json({ ward: res, nearby });
}
