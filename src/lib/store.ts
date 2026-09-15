"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  catalog,
  finishes,
  products,
  type FinishId,
  type ModelId,
} from "./catalog";
import { cartLineKey } from "@/commerce/sku";
import { cartCount, subtotalOf } from "@/commerce/cartMath";
import type { CartLine, CustomerSnapshot } from "@/commerce/types";

export type Selection = {
  modelId: ModelId;
  finishId: FinishId;
  size: number;
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
  setModel: (modelId: ModelId) => void;
  setFinish: (finishId: FinishId) => void;
  setSize: (size: number) => void;
  setDraft: (patch: Partial<CheckoutDraft>) => void;
  addSelectionToCart: (qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
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
        finishId: "white",
        size: 8,
      },
      cart: [],
      cartOpen: false,
      draft: emptyDraft,
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
          return { selection: { modelId, finishId: nextFinish, size } };
        }),
      setFinish: (finishId) =>
        set((state) => ({
          selection: { ...state.selection, finishId },
        })),
      setSize: (size) =>
        set((state) => ({
          selection: { ...state.selection, size },
        })),
      setDraft: (patch) =>
        set((state) => ({ draft: { ...state.draft, ...patch } })),
      addSelectionToCart: (qty = 1) => {
        const { selection } = get();
        const key = cartLineKey(selection.modelId, selection.finishId, selection.size);
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
                  size: selection.size,
                  qty,
                },
              ];
          return { cart, cartOpen: true };
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
      clearCart: () => set({ cart: [] }),
      openCart: () => set({ cartOpen: true }),
      closeCart: () => set({ cartOpen: false }),
      toggleCart: () => set((state) => ({ cartOpen: !state.cartOpen })),
    }),
    {
      name: "mora-atelier",
      version: 5,
      partialize: (state) => ({
        selection: state.selection,
        cart: state.cart,
        draft: state.draft,
      }),
      migrate: (persisted) => {
        const data = persisted as {
          selection?: { modelId?: string };
          cart?: CartLine[];
          draft?: CheckoutDraft;
        };
        if (
          data.selection?.modelId === "aura" ||
          data.selection?.modelId === "cera" ||
          data.selection?.modelId === "alba"
        ) {
          data.selection.modelId = "aero";
        }
        if (data.selection?.modelId === "pulse") data.selection.modelId = "titan";
        return {
          selection: data.selection,
          cart: data.cart ?? [],
          draft: { ...emptyDraft, ...data.draft },
        } as never;
      },
    },
  ),
);

export function selectionLabel(selection: Selection) {
  const model = products[selection.modelId];
  const finish = finishes[selection.finishId];
  return `Mora ${model.name} · ${finish.title} · #${selection.size}`;
}

export function useCartCount() {
  return useMoraStore((state) => cartCount(state.cart));
}

export function useCartSubtotal() {
  return useMoraStore((state) => subtotalOf(state.cart));
}

export { catalog, finishes, products };
