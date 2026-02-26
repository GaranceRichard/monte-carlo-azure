const COOKIE_NAME = "IDMontecarlo";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readCookie(name: string): string {
  const source = document.cookie || "";
  const parts = source.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return "";
}

function makeClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const randomHex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${randomHex()}-${randomHex().slice(0, 4)}-4${randomHex().slice(0, 3)}-a${randomHex().slice(0, 3)}-${randomHex()}${randomHex().slice(0, 4)}`;
}

export function ensureMontecarloClientCookie(): string {
  const existing = readCookie(COOKIE_NAME);
  if (UUID_V4_RE.test(existing)) return existing;

  const id = makeClientId();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Strict`;
  return id;
}
