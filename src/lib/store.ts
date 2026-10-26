"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  catalog,
  finishLabel,
  finishes,
  isFinishId,
  isModelId,
  products,
  type FinishId,
  type ModelId,
} from "./catalog";
import { CASE_PRODUCT, caseLineKey, isCaseColorId, type CaseColorId } from "./cases";
import { cartLineKey } from "@/commerce/sku";
import { cartCount, subtotalOf } from "@/commerce/cartMath";
import { isCaseLine } from "@/commerce/lines";
import { PENDING_SIZE } from "@/commerce/sizing";
import type { CartLine, CustomerSnapshot, SizingMethod } from "@/commerce/types";

export type Selection = {
  modelId: ModelId;
  finishId: FinishId;
  size: number;
  sizing: SizingMethod | null;
};

export type CheckoutDraft = CustomerSnapshot & {
  departamento: string;
  ciudad: string;
  address: string;
  referencia: string;
  notes: string;
};

type Store = {
  selection: Selection;
  cart: CartLine[];
  cartOpen: boolean;
  draft: CheckoutDraft;
  cartSessionId: string;
  offerCode: string;
  setModel: (modelId: ModelId) => void;
  setFinish: (finishId: FinishId) => void;
  setSize: (size: number) => void;
  setSizing: (sizing: SizingMethod | null) => void;
  setDraft: (patch: Partial<CheckoutDraft>) => void;
  addSelectionToCart: (qty?: number) => void;
  addCaseToCart: (colorId: CaseColorId, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  ensureCartSession: () => string;
  setOfferCode: (code: string) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

const emptyDraft: CheckoutDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  documentType: "CC",
  documentNumber: "",
  departamento: "",
  ciudad: "",
  address: "",
  referencia: "",
  notes: "",
};

function defaultFinish(modelId: ModelId): FinishId {
  return products[modelId].finishes[0];
}

function retireUnavailableSize(line: CartLine): CartLine {
  if (!isModelId(line.modelId) || line.size !== 6) return line;
  const finishId = isFinishId(line.finishId)
    ? line.finishId
    : products[line.modelId].finishes[0];
  return {
    ...line,
    finishId,
    sizing: "kit",
    size: PENDING_SIZE,
    key: cartLineKey(line.modelId, finishId, PENDING_SIZE, "kit"),
  };
}

export const useMoraStore = create<Store>()(
  persist(
    (set, get) => ({
      selection: {
        modelId: "aero",
        finishId: "lilac",
        size: 8,
        sizing: "self",
      },
      cart: [],
      cartOpen: false,
      draft: emptyDraft,
      cartSessionId: "",
      offerCode: "",
      setModel: (modelId) =>
        set((state) => {
          const nextFinish = products[modelId].finishes.includes(
            state.selection.finishId,
          )
            ? state.selection.finishId
            : defaultFinish(modelId);
          const sizes = products[modelId].sizes;
          const size = sizes.includes(state.selection.size)
            ? state.selection.size
            : sizes[Math.floor(sizes.length / 2)];
          return {
            selection: {
              ...state.selection,
              modelId,
              finishId: nextFinish,
              size,
              sizing: "self",
            },
          };
        }),
      setFinish: (finishId) =>
        set((state) => ({
          selection: { ...state.selection, finishId },
        })),
      setSize: (size) =>
        set((state) => ({
          selection: { ...state.selection, size, sizing: "self" },
        })),
      setSizing: (sizing) =>
        set((state) => ({
          selection: {
            ...state.selection,
            sizing,
            size:
              state.selection.size && state.selection.size !== PENDING_SIZE
                ? state.selection.size
                : 8,
          },
        })),
      setDraft: (patch) =>
        set((state) => ({ draft: { ...state.draft, ...patch } })),
      addSelectionToCart: (qty = 1) => {
        const { selection } = get();
        const sizing = selection.sizing ?? "self";
        const size = sizing === "kit" ? PENDING_SIZE : selection.size;
        const key = cartLineKey(
          selection.modelId,
          selection.finishId,
          size,
          sizing,
        );
        set((state) => {
          const existing = state.cart.find((line) => line.key === key);
          const cart = existing
            ? state.cart.map((line) =>
                line.key === key ? { ...line, qty: line.qty + qty } : line,
              )
            : [
                ...state.cart,
                {
                  key,
                  modelId: selection.modelId,
                  finishId: selection.finishId,
                  size,
                  sizing,
                  qty,
                },
              ];
          return { cart, cartOpen: false };
        });
      },
      addCaseToCart: (colorId, qty = 1) => {
        const color = isCaseColorId(colorId) ? colorId : CASE_PRODUCT.colors[0];
        const key = caseLineKey(color);
        set((state) => {
          const existing = state.cart.find((line) => line.key === key);
          const cart = existing
            ? state.cart.map((line) =>
                line.key === key ? { ...line, qty: line.qty + qty } : line,
              )
            : [
                ...state.cart,
                {
                  key,
                  kind: "case" as const,
                  modelId: "case" as const,
                  finishId: color,
                  size: 0,
                  sizing: "self" as const,
                  qty,
                },
              ];
          return { cart, cartOpen: false };
        });
      },
      setQty: (key, qty) =>
        set((state) => ({
          cart:
            qty <= 0
              ? state.cart.filter((line) => line.key !== key)
              : state.cart.map((line) =>
                  line.key === key ? { ...line, qty } : line,
                ),
        })),
      removeLine: (key) =>
        set((state) => ({
          cart: state.cart.filter((line) => line.key !== key),
        })),
      clearCart: () =>
        set({ cart: [], cartSessionId: "", offerCode: "" }),
      ensureCartSession: () => {
        const current = get().cartSessionId;
        if (current) return current;
        const next =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
                const rand = (Math.random() * 16) | 0;
                const value = char === "x" ? rand : (rand & 0x3) | 0x8;
                return value.toString(16);
              });
        set({ cartSessionId: next });
        return next;
      },
      setOfferCode: (code) => set({ offerCode: code.trim().toUpperCase() }),
      openCart: () => set({ cartOpen: true }),
      closeCart: () => set({ cartOpen: false }),
      toggleCart: () => set((state) => ({ cartOpen: !state.cartOpen })),
    }),
    {
      name: "mora-atelier",
      version: 10,
      partialize: (state) => ({
        selection: state.selection,
        cart: state.cart,
        draft: state.draft,
        cartSessionId: state.cartSessionId,
        offerCode: state.offerCode,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Store>;
        const selection = saved.selection
          ? { ...current.selection, ...saved.selection, finishId: current.selection.finishId }
          : current.selection;
        if (
          isModelId(selection.modelId) &&
          !products[selection.modelId].sizes.includes(selection.size)
        ) {
          selection.size = products[selection.modelId].sizes[0];
        }
        return {
          ...current,
          ...saved,
          selection,
        };
      },
      migrate: (persisted) => {
        const data = persisted as {
          selection?: {
            modelId?: string;
            finishId?: FinishId;
            size?: number;
            sizing?: SizingMethod | null;
          };
          cart?: CartLine[];
          draft?: CheckoutDraft;
          cartSessionId?: string;
          offerCode?: string;
        };
        if (
          data.selection?.modelId === "aura" ||
          data.selection?.modelId === "cera" ||
          data.selection?.modelId === "alba"
        ) {
          data.selection.modelId = "aero";
        }
        if (data.selection?.modelId === "pulse") data.selection.modelId = "titan";
        if (data.selection && data.selection.sizing == null) {
          data.selection.sizing = "self";
        }
        if (
          data.selection &&
          isModelId(data.selection.modelId) &&
          !products[data.selection.modelId].sizes.includes(data.selection.size ?? 0)
        ) {
          data.selection.size = products[data.selection.modelId].sizes[0];
        }
        const cart = (data.cart ?? [])
          .filter((line) => isCaseLine(line) || isModelId(line.modelId))
          .map((line) =>
            isCaseLine(line)
              ? {
                  ...line,
                  kind: "case" as const,
                  modelId: "case" as const,
                  sizing: "self" as const,
                  size: 0,
                }
              : retireUnavailableSize({
                  ...line,
                  kind: "ring" as const,
                  sizing: line.sizing ?? "self",
                }),
          )
          .reduce<CartLine[]>((items, line) => {
            const hit = items.find((item) => item.key === line.key);
            if (hit) hit.qty += line.qty;
            else items.push(line);
            return items;
          }, []);
        return {
          selection: data.selection,
          cart,
          draft: { ...emptyDraft, ...data.draft },
          cartSessionId: data.cartSessionId ?? "",
          offerCode: data.offerCode ?? "",
        } as never;
      },
    },
  ),
);

export function selectionLabel(selection: Selection) {
  const model = products[selection.modelId];
  const size =
    selection.sizing === "kit" || !selection.size
      ? "Medidor primero"
      : `#${selection.size}`;
  return `Mora ${model.name} · ${finishLabel(selection.modelId, selection.finishId)} · ${size}`;
}

export function useCartCount() {
  return useMoraStore((state) => cartCount(state.cart));
}

export function useCartSubtotal() {
  return useMoraStore((state) => subtotalOf(state.cart));
}

export { catalog, finishes, products };
