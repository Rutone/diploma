"use client";

import { useActionState } from "react";
import { checkReceipt } from "@/app/actions";
import { Submit } from "@/components/client";

export default function ReceiptCheck({ initiativeId }: { initiativeId: number }) {
  const [state, action] = useActionState(
    checkReceipt,
    null as { ok: boolean; found?: boolean; error?: string } | null
  );

  return (
    <section className="card p-5">
      <h2 className="sec-title">Саналаа шалгах</h2>
      <p className="hint mb-3" style={{ marginTop: 0 }}>
        Санал өгөх үедээ авсан баталгааны кодоо оруулснаар таны санал эцсийн тоонд орсон
        эсэхийг шалгана. Систем таны сонголтыг хэзээ ч ил болгохгүй.
      </p>
      <form action={action} className="flex gap-2">
        <input type="hidden" name="id" value={initiativeId} />
        <input
          name="code"
          className="input tabular-nums"
          placeholder="A1B2-C3D4"
          maxLength={9}
          aria-label="Баталгааны код"
        />
        <Submit className="btn btn-ghost">Шалгах</Submit>
      </form>
      {state?.error && (
        <p className="text-[13.5px] mt-2" style={{ color: "var(--bad)" }}>
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p
          className="text-[14px] mt-2"
          style={{ color: state.found ? "var(--ok)" : "var(--bad)" }}
        >
          {state.found
            ? "Энэ код бүхий санал эцсийн тоонд бүртгэгдсэн байна."
            : "Ийм код бүхий санал олдсонгүй. Кодоо шалгана уу."}
        </p>
      )}
    </section>
  );
}
