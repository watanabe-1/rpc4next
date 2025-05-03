import type { ContentType } from "../server";

/**
 * Represents HTTP request headers with optional fields.
 * This type includes general request headers, CORS/security-related headers, and client-specific headers.
 */
export type HttpRequestHeaders = Partial<{
  // General headers
  Accept: string;
  "Accept-Charset": string;
  "Accept-Datetime": string;
  "Accept-Encoding": string;
  "Accept-Language": string;
  Authorization: string;
  "Cache-Control": string;
  Connection: string;
  "Content-Length": string;
  "Content-Type": ContentType;
  Cookie: string;
  Date: string;
  Expect: string;
  Forwarded: string;
  From: string;
  Host: string;
  "If-Match": string;
  "If-Modified-Since": string;
  "If-None-Match": string;
  "If-Range": string;
  "If-Unmodified-Since": string;
  "Max-Forwards": string;
  Origin: string;
  Range: string;
  Referer: string;
  TE: string;
  Trailer: string;
  "Transfer-Encoding": string;
  Upgrade: string;
  "Upgrade-Insecure-Requests": string;
  "User-Agent": string;
  Via: string;

  // CORS and security-related headers
  "Access-Control-Request-Method": string;
  "Access-Control-Request-Headers": string;
  "Sec-Fetch-Dest": string;
  "Sec-Fetch-Mode": string;
  "Sec-Fetch-Site": string;
  "Sec-Fetch-User": string;
  "Sec-Purpose": string;

  // Client hints
  "Device-Memory": string;

  // Others
  Priority: string;
  "Origin-Agent-Cluster": string;
  "Service-Worker": string;
  "Service-Worker-Allowed": string;
  "Service-Worker-Navigation-Preload": string;
  "Set-Login": string;
  SourceMap: string;
}>;
