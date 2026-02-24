import * as ProgressPrimitive from "@radix-ui/react-progress";

type ProgressBarProps = {
  value: number;
};

export default function ProgressBar({ value }: ProgressBarProps) {
  return (
    <ProgressPrimitive.Root
      value={value}
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--softBorder)]"
    >
      <ProgressPrimitive.Indicator
        className="h-full rounded-full bg-[var(--brand)] transition-transform duration-700 ease-out"
        style={{ transform: `translateX(${value - 100}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
