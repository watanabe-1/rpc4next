import type { ContentType } from "./content-type-types";

/**
 * Represents HTTP response headers with optional fields, parameterized by the content type.
 * This type includes common headers used for caching, content description, CORS, authentication, security, cookies, redirects, connection, and server information.
 *
 * @template TContentType - The specific content type for the `Content-Type` header.
 */
export type HttpResponseHeaders<TContentType extends ContentType> = Partial<{
  // Cache control
  "Cache-Control": string;
  Expires: string;
  ETag: string;
  "Last-Modified": string;

  // Content information
  "Content-Type": TContentType;
  "Content-Length": string;
  "Content-Encoding": string;
  "Content-Language": string;
  "Content-Location": string;
  "Content-Disposition": string;

  // CORS (Cross-Origin Resource Sharing)
  "Access-Control-Allow-Origin": string;
  "Access-Control-Allow-Credentials": string;
  "Access-Control-Allow-Headers": string;
  "Access-Control-Allow-Methods": string;
  "Access-Control-Expose-Headers": string;

  // Authentication
  "WWW-Authenticate": string;
  Authorization: string;

  // Security
  "Strict-Transport-Security": string;
  "Content-Security-Policy": string;
  "X-Content-Type-Options": string;
  "X-Frame-Options": string;
  "X-XSS-Protection": string;
  "Referrer-Policy": string;
  "Permissions-Policy": string;
  "Cross-Origin-Opener-Policy": string;
  "Cross-Origin-Embedder-Policy": string;
  "Cross-Origin-Resource-Policy": string;

  // Cookies
  "Set-Cookie": string;

  // Redirect
  Location: string;

  // Connection and communication
  Connection: string;
  "Keep-Alive": string;
  "Transfer-Encoding": string;
  Upgrade: string;
  Vary: string;

  // Server information
  Date: string;
  Server: string;
  "X-Powered-By": string;
}>;
