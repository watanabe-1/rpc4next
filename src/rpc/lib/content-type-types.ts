type KnownContentType =
  | "application/json"
  | "text/html"
  | "text/plain"
  | "application/javascript"
  | "text/css"
  | "image/png"
  | "image/jpeg"
  | "image/svg+xml"
  | "application/pdf"
  | "application/octet-stream"
  | "multipart/form-data"
  | "application/x-www-form-urlencoded";

/**
 * A content type that can be either one of the predefined `KnownContentType` values,
 * or any other custom string.
 */
// Allow KnownContentType values with autocomplete, plus any custom string.
// (string & {}) keeps literal types while accepting arbitrary strings.
export type ContentType = KnownContentType | (string & {});
