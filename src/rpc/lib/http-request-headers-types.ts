import type { ContentType } from "../server";

/**
 * Represents HTTP request headers with optional fields.
 * This type includes general request headers, CORS/security-related headers, and client-specific headers.
 */
export type HttpRequestHeaders = Partial<{
  // General information
  Accept: string;
  "Accept-Charset": string;
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
  Pragma: string;
  Range: string;
  Referer: string;
  TE: string;
  Trailer: string;
  "Transfer-Encoding": string;
  Upgrade: string;
  "User-Agent": string;
  Via: string;
  Warning: string;

  // CORS / Security-related
  "Access-Control-Request-Method": string;
  "Access-Control-Request-Headers": string;
  DNT: string; // Do Not Track
  "Sec-Fetch-Dest": string;
  "Sec-Fetch-Mode": string;
  "Sec-Fetch-Site": string;
  "Sec-Fetch-User": string;
  "Sec-CH-UA": string;
  "Sec-CH-UA-Platform": string;
  "Sec-CH-UA-Mobile": string;
}>;
