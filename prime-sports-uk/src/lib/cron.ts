import "server-only";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Anything else is refused. */
export function cronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
