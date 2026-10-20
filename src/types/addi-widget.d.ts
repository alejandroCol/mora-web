import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "addi-widget": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        price?: string;
        "ally-slug"?: string;
      };
    }
  }
}

export {};
