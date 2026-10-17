import { json, fail } from '@/lib/api';
import { MAX_DISTANCE_FROM_CENTRE_M, MAX_NOTE_LENGTH, MAX_UPLOAD_BYTES, REPORT_TYPES, ROADS, categoriesOf, type Category, type ReportType, type Road } from '@/lib/constants';
import { normEmail, normPhone } from '@/lib/contact';
import { distanceFromRanchiM, inRanchi } from '@/lib/geo';
import { processPhoto } from '@/lib/image';
import { addEvent, insertReport, newId, recordReporterVote } from '@/lib/reports';
import { clientId, rateLimit } from '@/lib/request';
import { getStorage } from '@/lib/storage';
import { getWard, resolveWard } from '@/lib/wards';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const client = clientId(req);
  // Basic abuse protection: 6 reports per hour per (hashed) IP.
  if (!rateLimit(`report:${client}`, 6, 60 * 60 * 1000)) return fail('rate', 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('bad_form');
  }

  // Honeypot: real users never fill this hidden field. Pretend success to waste bots' time.
  if (form.get('website')) return json({ id: 'XXXXXXXX' });

  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) return fail('photo');
  if (photo.size > MAX_UPLOAD_BYTES) return fail('photo_too_large', 413);

  const lat = Number(form.get('lat'));
  const lng = Number(form.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail('loc');
  // Reports are only for people in Ranchi: the phone's own GPS position must be in the city, wherever the pin is.
  const meLat = Number(form.get('meLat'));
  const meLng = Number(form.get('meLng'));
  if (form.get('meLat') == null || !Number.isFinite(meLat) || !Number.isFinite(meLng)) return fail('need_location');
  if (!inRanchi(meLat, meLng, Number(form.get('meAccuracy')))) return json({ error: 'not_in_ranchi', km: Math.round(distanceFromRanchiM(meLat, meLng) / 1000) }, 403);
  if (distanceFromRanchiM(lat, lng) > MAX_DISTANCE_FROM_CENTRE_M) return fail('outside');

  // At least one way to tell the reporter the spot was cleared. Both are validated; a filled-in but invalid one is an error.
  const emailRaw = String(form.get('email') ?? '').trim();
  const phoneRaw = String(form.get('phone') ?? '').trim();
  const contactEmail = emailRaw ? normEmail(emailRaw) : null;
  const contactPhone = phoneRaw ? normPhone(phoneRaw) : null;
  if (emailRaw && !contactEmail) return fail('email');
  if (phoneRaw && !contactPhone) return fail('phone');
  if (!contactEmail && !contactPhone) return fail('contact');

  const acc = Number(form.get('accuracy'));
  const locSource = form.get('locSource') === 'pin' ? 'pin' : 'gps';

  const typeRaw = String(form.get('type') ?? 'garbage');
  if (!(REPORT_TYPES as readonly string[]).includes(typeRaw)) return fail('type');
  const type = typeRaw as ReportType;
  // A pothole's office depends on who owns the road, so the reporter has to say.
  const roadRaw = String(form.get('road') ?? '');
  const road = type === 'pothole' && (ROADS as readonly string[]).includes(roadRaw) ? (roadRaw as Road) : null;
  if (type === 'pothole' && !road) return fail('road');

  const catRaw = String(form.get('category') ?? '');
  const category = (categoriesOf(type) as readonly string[]).includes(catRaw) ? (catRaw as Category) : null;
  const note = String(form.get('note') ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_LENGTH) || null;

  const auto = resolveWard(lat, lng);
  const chosen = Number(form.get('ward'));
  const ward = chosen && getWard(chosen) ? chosen : auto.ward;
  const wardAuto = ward === auto.ward;

  let processed;
  try {
    processed = await processPhoto(Buffer.from(await photo.arrayBuffer()));
  } catch {
    return fail('photo_invalid');
  }

  const id = newId();
  const storage = getStorage();
  const photoKey = `${id}.jpg`;
  const thumbKey = `${id}_t.jpg`;
  await storage.put(photoKey, processed.full);
  await storage.put(thumbKey, processed.thumb);

  insertReport({
    id,
    type,
    road,
    createdAt: Date.now(),
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    accuracy: Number.isFinite(acc) && acc > 0 ? Math.round(acc) : null,
    locSource,
    ward,
    wardAuto,
    category,
    note,
    photo: photoKey,
    thumb: thumbKey,
    contactEmail,
    contactPhone,
  });
  addEvent(id, 'reported');
  recordReporterVote(id, client);
  return json({ id });
}
