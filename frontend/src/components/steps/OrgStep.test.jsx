import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("submits on Enter in org select when valid and not loading", () => {
    const onContinue = vi.fn();

    render(
      <OrgStep
        err=""
        userName="Garance"
        orgs={[{ id: "1", name: "org-a" }]}
        orgHint=""
        selectedOrg="org-a"
        setSelectedOrg={vi.fn()}
        loading={false}
        onContinue={onContinue}
      />,
    );

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
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

  it("submits on Enter in manual org input when valid and not loading", () => {
    const onContinue = vi.fn();

    render(
      <OrgStep
        err=""
        userName="User"
        orgs={[]}
        orgHint=""
        selectedOrg="org-demo"
        setSelectedOrg={vi.fn()}
        loading={false}
        onContinue={onContinue}
      />,
    );

    const input = screen.getByPlaceholderText("Nom de l'organisation");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("does not submit on Enter in manual org input when loading or empty", () => {
    const onContinueLoading = vi.fn();
    const onContinueEmpty = vi.fn();

    const { rerender } = render(
      <OrgStep
        err=""
        userName="User"
        orgs={[]}
        orgHint=""
        selectedOrg="org-demo"
        setSelectedOrg={vi.fn()}
        loading
        onContinue={onContinueLoading}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText("Nom de l'organisation"), { key: "Enter" });
    expect(onContinueLoading).not.toHaveBeenCalled();

    rerender(
      <OrgStep
        err=""
        userName="User"
        orgs={[]}
        orgHint=""
        selectedOrg="   "
        setSelectedOrg={vi.fn()}
        loading={false}
        onContinue={onContinueEmpty}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText("Nom de l'organisation"), { key: "Enter" });
    expect(onContinueEmpty).not.toHaveBeenCalled();
  });

  it("focuses manual org input when an error is displayed", async () => {
    const { rerender } = render(
      <OrgStep
        err=""
        userName="User"
        orgs={[]}
        orgHint=""
        selectedOrg="org-demo"
        setSelectedOrg={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Nom de l'organisation");
    expect(document.activeElement).not.toBe(input);

    rerender(
      <OrgStep
        err="Organisation inaccessible"
        userName="User"
        orgs={[]}
        orgHint=""
        selectedOrg=""
        setSelectedOrg={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByPlaceholderText("Nom de l'organisation"));
    });
  });

  it("focuses organization select when org list is available", async () => {
    render(
      <OrgStep
        err=""
        userName="User"
        orgs={[{ id: "1", name: "org-a" }]}
        orgHint=""
        selectedOrg="org-a"
        setSelectedOrg={vi.fn()}
        loading={false}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("combobox"));
    });
  });
});
