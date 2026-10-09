/** Runs once when the server starts. Background jobs only make sense in a long-running production server. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    const { startMaintenance } = await import('./lib/maintenance');
    startMaintenance();
  }
}
