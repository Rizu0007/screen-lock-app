// postgres.js sends unknown URL params to the server as settings; drop libpq-only ones (e.g. Neon's channel_binding).
const LIBPQ_ONLY_PARAMS = ["channel_binding", "gssencmode", "sslcompression"];

export function normalizeDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  for (const param of LIBPQ_ONLY_PARAMS) url.searchParams.delete(param);
  return url.toString();
}
