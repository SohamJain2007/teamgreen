// Reporter contact details, used only to tell them when their spot is cleared. Shared by the form and the API.

/** Indian mobile number as 10 digits (accepts +91 / 0 prefixes and spaces/dashes), or null if invalid. */
export function normPhone(raw: string | null | undefined): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** Lower-cased email, or null if it does not look like one. */
export function normEmail(raw: string | null | undefined): string | null {
  const e = String(raw ?? '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : null;
}
