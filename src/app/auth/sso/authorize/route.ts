import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueAuthorizationCode } from "@/lib/auth/mock-sso";

/**
 * Хуурамч SSO-гийн баталгаажуулах цэг.
 *
 * Жинхэнэ нэвтрэлтийн сервер шиг ЭНГИЙН HTML маягтын POST-оор ажиллана —
 * хөтөч бүрэн шилжилт (document navigation) хийх тул дараагийн алхмуудын
 * cookie найдвартай хадгалагдана.
 *
 * Амжилттай таньсны дараа нэг удаагийн кодыг redirect_uri руу залгаж
 * 303-аар буцаана (POST → GET).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const userCode = String(form.get("userCode") ?? "").trim().toUpperCase();
  const state = String(form.get("state") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "/auth/callback");

  const back = (error: string) => {
    const p = new URLSearchParams({ state, redirect_uri: redirectUri, error });
    return NextResponse.redirect(new URL(`/auth/sso?${p}`, req.nextUrl.origin), 303);
  };

  if (!userCode) return back("Оюутны код эсвэл ажилтны дугаараа оруулна уу.");

  const user = await prisma.user.findUnique({ where: { code: userCode } });
  if (!user || !user.active) return back("Ийм кодтой идэвхтэй хэрэглэгч олдсонгүй. Кодоо шалгана уу.");

  const target = new URL(redirectUri, req.nextUrl.origin);
  target.searchParams.set("code", issueAuthorizationCode(user.code));
  target.searchParams.set("state", state);

  return NextResponse.redirect(target, 303);
}
