"use client";

import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { useEffect } from "react";
import { getFirebaseApp } from "@/lib/firebase";
import type { CaseOfferAction, InsightEvent, InsightImageKind } from "./types";
import { CASE_OFFER_ACTIONS, FUNNEL_STEPS, type FunnelStep } from "./types";

const VISITOR_KEY = "mora-insight";
const QUEUE_FLUSH_MS = 900;
const IMAGE_DWELL_MS = 700;
const MAX_QUEUE = 24;

let visitorMemo = "";
let queue: InsightEvent[] = [];
let flushTimer: number | null = null;
let hooksBound = false;
const seenSession = new Set<string>();

function visitorId() {
  if (visitorMemo) return visitorMemo;
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(VISITOR_KEY)?.trim();
    if (stored && stored.length <= 64) {
      visitorMemo = stored;
      return stored;
    }
  } catch {
    /* private mode */
  }
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  visitorMemo = next;
  try {
    window.localStorage.setItem(VISITOR_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

function skipPath(path: string) {
  return (
    path.startsWith("/superadmin") ||
    path.startsWith("/acceso") ||
    path.startsWith("/circulo") ||
    path.startsWith("/encuesta")
  );
}

function shouldSkip() {
  if (typeof window === "undefined") return true;
  if (skipPath(window.location.pathname)) return true;
  if (navigator.webdriver) return true;
  return false;
}

function once(key: string) {
  if (seenSession.has(key)) return false;
  seenSession.add(key);
  return true;
}

function mirrorFirebase(event: InsightEvent) {
  void isSupported()
    .then((ok) => {
      if (!ok) return;
      const analytics = getAnalytics(getFirebaseApp());
      if (event.name === "funnel") {
        logEvent(analytics, "funnel_step", { step: event.step });
        return;
      }
      if (event.name === "product_view") {
        logEvent(analytics, "view_item", {
          item_id: event.productId,
          item_name: event.productName ?? event.productId,
        });
        return;
      }
      if (event.name === "product_cart") {
        logEvent(analytics, "add_to_cart", { item_id: event.productId });
        return;
      }
      if (event.name === "product_checkout") {
        logEvent(analytics, "begin_checkout", { item_id: event.productId });
        return;
      }
      if (event.name === "image_view") {
        logEvent(analytics, "view_image", {
          item_id: event.productId,
          image_id: event.imageId,
        });
        return;
      }
      if (event.name === "case_offer") {
        logEvent(analytics, "case_offer", { action: event.action });
      }
    })
    .catch(() => undefined);
}

function bindFlushHooks() {
  if (hooksBound || typeof window === "undefined") return;
  hooksBound = true;
  const flush = () => sendQueue();
  window.addEventListener("pagehide", flush);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

function sendQueue() {
  if (flushTimer != null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length || shouldSkip()) {
    queue = [];
    return;
  }
  const events = queue.slice(0, MAX_QUEUE);
  queue = [];
  const body = JSON.stringify({ visitorId: visitorId(), events });
  const url = "/api/insights";
  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    /* fall through */
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function enqueue(event: InsightEvent, uniqueKey?: string) {
  if (shouldSkip()) return;
  if (uniqueKey && !once(uniqueKey)) return;
  bindFlushHooks();
  queue.push(event);
  if (queue.length >= MAX_QUEUE) {
    sendQueue();
    return;
  }
  if (flushTimer != null) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(sendQueue, QUEUE_FLUSH_MS);
  mirrorFirebase(event);
}

export function insightFunnel(step: FunnelStep) {
  if (!FUNNEL_STEPS.includes(step)) return;
  enqueue({ name: "funnel", step }, `funnel:${step}`);
}

export function insightProductView(productId: string, productName: string) {
  enqueue({ name: "product_view", productId, productName }, `product:${productId}`);
  insightFunnel("product");
}

export function insightProductCart(productId: string, productName: string) {
  enqueue({ name: "product_cart", productId, productName });
  insightFunnel("cart");
}

export function insightProductCheckout(productId: string, productName: string) {
  enqueue({ name: "product_checkout", productId, productName }, `checkout:${productId}`);
}

export function insightCaseOffer(action: CaseOfferAction) {
  if (!CASE_OFFER_ACTIONS.includes(action)) return;
  enqueue({ name: "case_offer", action }, `case_offer:${action}`);
}

export function insightImageView(input: {
  productId: string;
  productName: string;
  imageId: string;
  imageSrc?: string;
  finishId?: string;
  kind?: InsightImageKind;
  label?: string;
}) {
  enqueue({
    name: "image_view",
    productId: input.productId,
    productName: input.productName,
    imageId: input.imageId,
    imageSrc: input.imageSrc,
    finishId: input.finishId,
    kind: input.kind ?? "photo",
    label: input.label,
  });
}

export function useInsightHome() {
  useEffect(() => {
    insightFunnel("home");
  }, []);
}

export function useInsightProduct(productId: string, productName: string) {
  useEffect(() => {
    if (!productId) return;
    insightProductView(productId, productName);
  }, [productId, productName]);
}

export function useInsightImage(input: {
  productId: string;
  productName: string;
  imageId: string;
  imageSrc?: string;
  finishId?: string;
  kind?: InsightImageKind;
  label?: string;
}) {
  const { productId, productName, imageId, imageSrc, finishId, kind, label } = input;
  useEffect(() => {
    if (!productId || !imageId) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    const timer = window.setTimeout(() => {
      insightImageView({
        productId,
        productName,
        imageId,
        imageSrc,
        finishId,
        kind,
        label,
      });
    }, IMAGE_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [productId, productName, imageId, imageSrc, finishId, kind, label]);
}
