import { cookies, headers } from "next/headers";

export const getHeadersObject = async () => {
  const headersList = await headers();
  const headersObj: Record<string, string> = {};

  for (const [key, value] of headersList.entries()) {
    headersObj[key] = value;
  }

  return headersObj;
};

export const getCookiesObject = async () => {
  const cookiesList = await cookies();
  const cookiesObj: Record<string, string> = {};

  for (const cookie of cookiesList.getAll()) {
    cookiesObj[cookie.name] = cookie.value;
  }

  return cookiesObj;
};
