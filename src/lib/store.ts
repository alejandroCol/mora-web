"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  catalog,
  finishLabel,
  finishes,
  products,
  type FinishId,
  type ModelId,
} from "./catalog";
import { cartLineKey } from "@/commerce/sku";
import { cartCount, subtotalOf } from "@/commerce/cartMath";
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

export const useMoraStore = create<Store>()(
  persist(
    (set, get) => ({
      selection: {
        modelId: "aero",
        finishId: "lilac",
        size: 8,
        sizing: null,
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
              sizing: null,
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
              sizing === "kit"
                ? PENDING_SIZE
                : state.selection.size || 8,
          },
        })),
      setDraft: (patch) =>
        set((state) => ({ draft: { ...state.draft, ...patch } })),
      addSelectionToCart: (qty = 1) => {
        const { selection } = get();
        const sizing = selection.sizing;
        if (!sizing) return;
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
      version: 7,
      partialize: (state) => ({
        selection: state.selection,
        cart: state.cart,
        draft: state.draft,
        cartSessionId: state.cartSessionId,
        offerCode: state.offerCode,
      }),
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
          data.selection.sizing = null;
        }
        const cart = (data.cart ?? []).map((line) => ({
          ...line,
          sizing: line.sizing ?? "self",
        }));
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
