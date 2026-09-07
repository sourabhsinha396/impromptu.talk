import { NextResponse, type NextRequest } from "next/server";

import {
  CURRENCY_COOKIE,
  CURRENCY_MAX_AGE,
  REFERRAL_COOKIE,
  REFERRAL_MAX_AGE,
  SESSION_COOKIE,
  referralCode,
} from "@/lib/cookies";
import { currencyCode } from "@/lib/geo";

/* Pages that need an account. A visitor without the session cookie is sent
   to sign in and brought back afterwards; the page still checks the
   session server-side, this only spares an obvious round trip.

   /administration is not here on purpose. It answers 404 to strangers, and
   a sign-in prompt would be a page confirming that the path exists. */
const SIGNED_IN = ["/account", "/genres/yours", "/affiliate/referrals"];

export default function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const response =
    needsAccount(pathname) && !request.cookies.has(SESSION_COOKIE) ? redirectToLogin(request) : NextResponse.next();

  /* `?ref=` on any page becomes the referral cookie. The link an affiliate
     is handed prints the home page, but one who links a genre page has still
     sent somebody, and a rule that only the front door counted would be a
     rule nobody was told. GET only: a form post carrying ?ref= is not a
     visit anybody was sent on. Last click wins, which is the ordinary rule
     and the only one a cookie can keep without turning into a list. */
  const get = request.method === "GET";
  const code = get ? referralCode(searchParams.get("ref")) : "";
  if (code) {
    response.cookies.set(REFERRAL_COOKIE, code, {
      maxAge: REFERRAL_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  /* `?currency=` is the top rung of the pricing ladder: a pick beats
     every signal under it, and only a pick is written down. Not httpOnly,
     unlike the two above: nothing is decided by holding it, it is a
     preference about what a page shows, and a person changing it in their
     own browser has only changed which price they are quoted, which the
     picker lets them do anyway. */
  const currency = get ? currencyCode(searchParams.get("currency")) : "";
  if (currency) {
    response.cookies.set(CURRENCY_COOKIE, currency, {
      maxAge: CURRENCY_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return response;
}

function needsAccount(pathname: string) {
  return SIGNED_IN.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToLogin(request: NextRequest) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

/* Every page, so a referral link can land anywhere. Not the API rewrite,
   which the backend answers, and not Next's own assets or the icons. */
export const config = { matcher: ["/((?!api/|_next/|favicon.ico|icon|apple-icon).*)"] };
