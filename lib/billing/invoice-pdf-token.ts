import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSessionPassword } from "@/lib/auth/session";

export type InvoicePdfRenderVariant = "internal" | "public";

type InvoicePdfRenderTokenPayload = {
  invoiceId: string;
  variant: InvoicePdfRenderVariant;
  expiresAt: number;
};

function signInvoicePdfRenderPayload(payload: string) {
  return createHmac("sha256", getSessionPassword()).update(payload).digest("base64url");
}

export function createInvoicePdfRenderToken(
  payload: InvoicePdfRenderTokenPayload
) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signInvoicePdfRenderPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyInvoicePdfRenderToken({
  token,
  invoiceId,
  variant,
}: {
  token: string | null | undefined;
  invoiceId: string;
  variant: InvoicePdfRenderVariant;
}) {
  if (!token) {
    return false;
  }

  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return false;
  }

  const expectedSignature = signInvoicePdfRenderPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<InvoicePdfRenderTokenPayload>;

    return (
      payload.invoiceId === invoiceId &&
      payload.variant === variant &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}
