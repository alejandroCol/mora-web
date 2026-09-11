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

export type Selection = {
  modelId: ModelId;
  finishId: FinishId;
  size: number;
};

export type OrderDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
};

export type PlacedOrder = Selection &
  OrderDraft & {
    id: string;
    placedAt: string;
    total: number;
  };

type Store = {
  selection: Selection;
  draft: OrderDraft;
  lastOrder: PlacedOrder | null;
  setModel: (modelId: ModelId) => void;
  setFinish: (finishId: FinishId) => void;
  setSize: (size: number) => void;
  setDraft: (patch: Partial<OrderDraft>) => void;
  placeOrder: () => PlacedOrder;
};

const emptyDraft: OrderDraft = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  address: "",
  notes: "",
};

function defaultFinish(modelId: ModelId): FinishId {
  return products[modelId].finishes[0];
}

export const useMoraStore = create<Store>()(
  persist(
    (set, get) => ({
      selection: {
        modelId: "cera",
        finishId: "white",
        size: 8,
      },
      draft: emptyDraft,
      lastOrder: null,
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
      placeOrder: () => {
        const { selection, draft } = get();
        const order: PlacedOrder = {
          ...selection,
          ...draft,
          id: `MORA-${Date.now().toString(36).toUpperCase()}`,
          placedAt: new Date().toISOString(),
          total: products[selection.modelId].price,
        };
        set({ lastOrder: order, draft: emptyDraft });
        return order;
      },
    }),
    {
      name: "mora-atelier",
      version: 2,
      migrate: (persisted) => {
        const data = persisted as { selection?: { modelId?: string } };
        if (data.selection?.modelId === "aura") data.selection.modelId = "cera";
        if (data.selection?.modelId === "pulse") data.selection.modelId = "titan";
        return data as never;
      },
    },
  ),
);

export function selectionLabel(selection: Selection) {
  const model = products[selection.modelId];
  const finish = finishes[selection.finishId];
  return `Mora ${model.name} · ${finish.title} · #${selection.size}`;
}

export { catalog, finishes, products };
