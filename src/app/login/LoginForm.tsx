"use client";

import { useActionState, useState } from "react";
import { requestOtp, confirmOtp } from "../actions";
import { Submit } from "@/components/client";

type Step1 = { ok: boolean; error?: string; code?: string; userCode?: string; info?: string } | null;
type Step2 = { ok: boolean; error?: string } | null;

export default function LoginForm({ demo }: { demo: { code: string; name: string; role: string }[] }) {
  const [s1, requestAction] = useActionState(requestOtp, null as Step1);
  const [s2, confirmAction] = useActionState(confirmOtp, null as Step2);
  const [userCode, setUserCode] = useState("");

  const sent = s1?.ok && s1.code;

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <p className="text-[14.5px] text-ink2">
          Оюутны код эсвэл ажилтны дугаараа оруулснаар сургуулийн и-мэйл рүү нэг удаагийн
          код илгээнэ. Шинэ бүртгэл үүсгэх, нууц үг цээжлэх шаардлагагүй.
        </p>
      </div>

      {!sent ? (
        <form action={requestAction} className="card p-5 space-y-3">
          <div>
            <label className="label" htmlFor="sc">
              Оюутны код / ажилтны дугаар
            </label>
            <input
              id="sc"
              name="userCode"
              className="input"
              placeholder="B2300001, T00001, A00001"
              autoCapitalize="characters"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              required
            />
          </div>
          {s1?.error && (
            <p className="text-[13.5px]" style={{ color: "var(--bad)" }} role="alert">
              {s1.error}
            </p>
          )}
          <Submit className="btn btn-primary w-full">Код авах</Submit>
        </form>
      ) : (
        <form action={confirmAction} className="card p-5 space-y-3">
          <input type="hidden" name="userCode" value={s1!.userCode} />
          <div
            className="rounded-lg p-3 text-[13.5px]"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            <strong className="font-medium">Демо орчин:</strong> бодит системд энэ код{" "}
            {s1!.info} хаяг руу илгээгдэнэ. Энд шууд харуулж байна —{" "}
            <span className="tabular-nums text-[16px] font-medium">{s1!.code}</span>
          </div>
          <div>
            <label className="label" htmlFor="otp">
              Нэг удаагийн код
            </label>
            <input
              id="otp"
              name="code"
              className="input tabular-nums"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              required
            />
            <p className="hint">Код 10 минутын дараа хүчингүй болно.</p>
          </div>
          {s2?.error && (
            <p className="text-[13.5px]" style={{ color: "var(--bad)" }} role="alert">
              {s2.error}
            </p>
          )}
          <Submit className="btn btn-primary w-full">Нэвтрэх</Submit>
        </form>
      )}

      <div className="card p-4">
        <h2 className="text-[14px] font-medium mb-2">Туршиж үзэх бүртгэлүүд</h2>
        <table className="data">
          <tbody>
            {demo.map((d) => (
              <tr key={d.code}>
                <td className="tabular-nums">
                  <button
                    className="link"
                    onClick={() => setUserCode(d.code)}
                    type="button"
                    disabled={!!sent}
                  >
                    {d.code}
                  </button>
                </td>
                <td>{d.name}</td>
                <td className="text-ink3">{d.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Код дээр дарж талбарт хуулж болно.</p>
      </div>
    </div>
  );
}
