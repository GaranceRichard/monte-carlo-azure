import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PatStep from "./PatStep";

describe("PatStep", () => {
  it("renders PAT and server URL inputs and calls onSubmit", () => {
    const onSubmit = vi.fn();
    const setPatInput = vi.fn();
    const setServerUrlInput = vi.fn();

    render(
      <PatStep
        err=""
        patInput=""
        serverUrlInput=""
        setPatInput={setPatInput}
        setServerUrlInput={setServerUrlInput}
        loading={false}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("Connexion Azure DevOps")).toBeInTheDocument();
    const serverUrlInput = screen.getByPlaceholderText("https://ado.monentreprise.local/tfs/DefaultCollection");
    fireEvent.change(serverUrlInput, { target: { value: "https://ado.local/tfs/CollectionA" } });
    expect(setServerUrlInput).toHaveBeenCalledWith("https://ado.local/tfs/CollectionA");

    const button = screen.getByRole("button", { name: "Se connecter" });
    const patInput = document.querySelector('input[type="password"]');
    expect(patInput).not.toBeNull();
    fireEvent.change(patInput, { target: { value: "new-pat-token" } });
    expect(setPatInput).toHaveBeenCalledWith("new-pat-token");

    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows error and triggers submit on Enter when not loading", () => {
    const onSubmit = vi.fn();

    render(
      <PatStep
        err="PAT invalide"
        patInput="abc"
        serverUrlInput=""
        setPatInput={vi.fn()}
        setServerUrlInput={vi.fn()}
        loading={false}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("Erreur :")).toBeInTheDocument();
    expect(screen.getByText("PAT invalide")).toBeInTheDocument();

    const input = document.querySelector('input[type="password"]');
    expect(input).not.toBeNull();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits from the server url field when pressing Enter and not loading", () => {
    const onSubmit = vi.fn();

    render(
      <PatStep
        err=""
        patInput=""
        serverUrlInput="https://ado.local/tfs/CollectionA"
        setPatInput={vi.fn()}
        setServerUrlInput={vi.fn()}
        loading={false}
        onSubmit={onSubmit}
      />,
    );

    const serverUrlInput = screen.getByPlaceholderText("https://ado.monentreprise.local/tfs/DefaultCollection");
    fireEvent.keyDown(serverUrlInput, { key: "Enter", code: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables submit button while loading and does not submit on Enter", () => {
    const onSubmit = vi.fn();

    render(
      <PatStep
        err=""
        patInput="abc"
        serverUrlInput=""
        setPatInput={vi.fn()}
        setServerUrlInput={vi.fn()}
        loading
        onSubmit={onSubmit}
      />,
    );

    const button = screen.getByRole("button", { name: "Validation..." });
    expect(button).toBeDisabled();

    const input = document.querySelector('input[type="password"]');
    expect(input).not.toBeNull();
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit from the server url field on Enter while loading", () => {
    const onSubmit = vi.fn();

    render(
      <PatStep
        err=""
        patInput="abc"
        serverUrlInput="https://ado.local/tfs/CollectionA"
        setPatInput={vi.fn()}
        setServerUrlInput={vi.fn()}
        loading
        onSubmit={onSubmit}
      />,
    );

    const serverUrlInput = screen.getByPlaceholderText("https://ado.monentreprise.local/tfs/DefaultCollection");
    fireEvent.keyDown(serverUrlInput, { key: "Enter", code: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("focuses PAT input when connection screen is displayed", async () => {
    render(
      <PatStep
        err=""
        patInput=""
        serverUrlInput=""
        setPatInput={vi.fn()}
        setServerUrlInput={vi.fn()}
        loading={false}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('input[type="password"]'));
    });
  });

  it("refocuses PAT input when an error appears", async () => {
    const { rerender } = render(
      <PatStep
        err=""
        patInput="bad-token"
        serverUrlInput=""
        setPatInput={vi.fn()}
        setServerUrlInput={vi.fn()}
        loading={false}
        onSubmit={vi.fn()}
      />,
    );

    const input = document.querySelector('input[type="password"]');
    expect(input).not.toBeNull();
    input.blur();
    expect(document.activeElement).not.toBe(input);

    rerender(
      <PatStep
        err="PAT invalide"
        patInput=""
        serverUrlInput=""
        setPatInput={vi.fn()}
        setServerUrlInput={vi.fn()}
        loading={false}
        onSubmit={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });
});
