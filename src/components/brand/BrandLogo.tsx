import { BRAND, type BrandAsset } from "@/brand";

const VARIANT_ASSET = {
  mark: "mark",
  wordmark: "wordmark",
} as const satisfies Record<string, BrandAsset>;

type BrandLogoProps = {
  variant?: keyof typeof VARIANT_ASSET;
  className?: string;
  alt?: string;
  priority?: boolean;
};

export function BrandLogo({
  variant = "mark",
  className = "",
  alt,
  priority = false,
}: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.assets[VARIANT_ASSET[variant]]}
      alt={alt ?? BRAND.name}
      className={`select-none ${className}`}
      draggable={false}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
