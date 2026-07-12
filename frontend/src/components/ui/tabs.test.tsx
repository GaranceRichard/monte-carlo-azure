import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "./tabs";

function ExampleTabs() {
  const [value, setValue] = useState("first");
  return <TabsRoot value={value} onValueChange={setValue}><TabsList><TabsTrigger value="first">Premier</TabsTrigger><TabsTrigger value="second">Second</TabsTrigger></TabsList><TabsContent value="first">Contenu premier</TabsContent><TabsContent value="second">Contenu second</TabsContent></TabsRoot>;
}

describe("tabs", () => {
  it("shows the selected panel and changes it through the public trigger", () => {
    render(<ExampleTabs />);
    expect(screen.getByText("Contenu premier")).toBeVisible();
    expect(screen.queryByText("Contenu second")).toBeNull();
    const secondTab = screen.getByRole("tab", { name: "Second" });
    fireEvent.mouseDown(secondTab);
    fireEvent.click(secondTab);
    expect(screen.getByText("Contenu second")).toBeVisible();
    expect(screen.queryByText("Contenu premier")).toBeNull();
  });
});
