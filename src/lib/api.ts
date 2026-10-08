import { NextResponse } from 'next/server';
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (code: string, status = 400) => json({ error: code }, status);
