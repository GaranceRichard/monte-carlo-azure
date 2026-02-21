import { fireEvent, render, screen } from "@testing-library/react";
import OrgStep from "./OrgStep";

describe("OrgStep", () => {
  it("renders selectable org list and submits", () => {
    const onContinue = vi.fn();
    const setSelectedOrg = vi.fn();

    render(
      <OrgStep
        err=""
        userName="Garance"
        orgs={[{ id: "1", name: "org-a" }, { id: "2", name: "org-b" }]}
        orgHint=""
        selectedOrg="org-a"
        setSelectedOrg={setSelectedOrg}
        loading={false}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByText("Bienvenue Garance")).toBeInTheDocument();
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "org-b" } });
    expect(setSelectedOrg).toHaveBeenCalledWith("org-b");

    fireEvent.click(screen.getByRole("button", { name: "Choisir cette organisation" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("renders manual org input when no org list is available", () => {
    const setSelectedOrg = vi.fn();

    render(
      <OrgStep
        err="Erreur test"
        userName="User"
        orgs={[]}
        orgHint="PAT non global"
        selectedOrg=""
        setSelectedOrg={setSelectedOrg}
        loading
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText("Erreur test")).toBeInTheDocument();
    expect(screen.getByText("PAT non global")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Nom de l'organisation");
    fireEvent.change(input, { target: { value: "org-demo" } });
    expect(setSelectedOrg).toHaveBeenCalledWith("org-demo");
    expect(screen.getByRole("button", { name: "Chargement..." })).toBeDisabled();
  });
});
