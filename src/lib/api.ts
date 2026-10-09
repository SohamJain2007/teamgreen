import { NextResponse } from 'next/server';
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (code: string, status = 400) => json({ error: code }, status);
/** 403 for an action that needs the person at the spot; says how far away they are (null = no location sent). */
export const tooFar = (distanceM: number | null) => json({ error: 'too_far', distanceM: distanceM == null ? null : Math.round(distanceM) }, 403);
