import { BrandLoader } from "./BrandLoader";

type LoadingScreenProps = {
  label?: string;
  className?: string;
};

export function LoadingScreen({
  label,
  className = "bg-paper",
}: LoadingScreenProps) {
  return (
    <div className={`grid min-h-dvh place-items-center ${className}`}>
      <BrandLoader label={label} />
    </div>
  );
}
