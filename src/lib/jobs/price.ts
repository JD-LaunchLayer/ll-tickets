import type { PriceBasis } from "@/lib/jobs/domain";

export type ResolvedPrice = {
  priceGbp: number | null;
  priceBasis: PriceBasis | null;
  priceAgreedAt: string | null;
};

export function resolvePrice(args: {
  priceGbp: number | null;
  priceBasis: PriceBasis | null;
  priceAgreedAt: string | null;
  priceGbpPresent: boolean;
  priceBasisPresent: boolean;
  priceAgreedAtPresent: boolean;
  now: Date;
  mode: "create" | "patch";
}): { ok: true; price: ResolvedPrice | "unchanged" } | { ok: false; message: string } {
  const anyPresent =
    args.priceGbpPresent || args.priceBasisPresent || args.priceAgreedAtPresent;
  if (!anyPresent) {
    if (args.mode === "create") {
      return {
        ok: true,
        price: { priceGbp: null, priceBasis: null, priceAgreedAt: null },
      };
    }
    return { ok: true, price: "unchanged" };
  }

  if (!args.priceGbpPresent || args.priceGbp === null) {
    if (args.priceBasisPresent || args.priceAgreedAtPresent) {
      return {
        ok: false,
        message: "A price basis or agreement time needs a price in pounds.",
      };
    }
    return {
      ok: true,
      price: { priceGbp: null, priceBasis: null, priceAgreedAt: null },
    };
  }

  let basis: PriceBasis = args.priceBasisPresent && args.priceBasis ? args.priceBasis : "estimate";
  let agreedAt = args.priceAgreedAtPresent ? args.priceAgreedAt : null;

  if (agreedAt && basis === "estimate" && args.priceBasisPresent) {
    return {
      ok: false,
      message:
        "An estimate is not an agreed price. Set price_basis to quote to record when it was agreed.",
    };
  }

  if (agreedAt && !args.priceBasisPresent) {
    basis = "quote";
  }

  if (basis === "quote" && !agreedAt) {
    agreedAt = args.now.toISOString();
  }

  if (basis === "estimate") {
    agreedAt = null;
  }

  return {
    ok: true,
    price: { priceGbp: args.priceGbp, priceBasis: basis, priceAgreedAt: agreedAt },
  };
}
