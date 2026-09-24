/**
 * postgres.js forwards unknown URL query parameters to the server as runtime
 * settings. Hosted providers (e.g. Neon) add libpq-only options such as
 * `channel_binding=require`, which the server then rejects with
 * `unrecognized configuration parameter`. Strip those before connecting.
 * `sslmode` is kept: postgres.js understands it.
 */
const LIBPQ_ONLY_PARAMS = ["channel_binding", "gssencmode", "sslcompression"];

export function normalizeDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  for (const param of LIBPQ_ONLY_PARAMS) url.searchParams.delete(param);
  return url.toString();
}
