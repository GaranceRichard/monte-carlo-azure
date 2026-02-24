import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

type TabsRootProps = {
  children: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
};

type TabsListProps = {
  children: ReactNode;
};

type TabsTriggerProps = {
  children: ReactNode;
  value: string;
};

type TabsContentProps = {
  children: ReactNode;
  value: string;
};

export function TabsRoot({ children, value, onValueChange }: TabsRootProps) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabsList({ children }: TabsListProps) {
  return (
    <TabsPrimitive.List className="inline-flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2">
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ children, value }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-[var(--muted)] transition data-[state=active]:border-[var(--brand)] data-[state=active]:bg-[var(--panel)] data-[state=active]:text-[var(--brand)]"
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ children, value }: TabsContentProps) {
  return (
    <TabsPrimitive.Content value={value} className="mt-4">
      {children}
    </TabsPrimitive.Content>
  );
}
