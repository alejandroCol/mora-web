"use client";

import { getAnalytics, isSupported } from "firebase/analytics";
import { useEffect } from "react";
import { getFirebaseApp } from "@/lib/firebase";

export function FirebaseAnalytics() {
  useEffect(() => {
    void isSupported().then((supported) => {
      if (supported) {
        getAnalytics(getFirebaseApp());
      }
    });
  }, []);

  return null;
}
