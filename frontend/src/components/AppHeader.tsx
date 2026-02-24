type AppHeaderProps = {
  theme: "light" | "dark";
  toggleTheme: () => void;
  showDisconnect?: boolean;
  onDisconnect: () => void;
  backLabel?: string;
  onBack?: (() => void) | null;
};

export default function AppHeader({
  theme,
  toggleTheme,
  showDisconnect = false,
  onDisconnect,
  backLabel = "",
  onBack = null,
}: AppHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Passer en mode jour" : "Passer en mode nuit"}
          className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold text-[var(--brand)]"
        >
          {theme === "dark" ? "Nuit" : "Jour"}
        </button>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Monte Carlo Studio</div>
          <h2 className="m-0 text-lg font-extrabold text-[var(--brand-strong)]">Simulation Delivery Forecast</h2>
        </div>
      </div>

      {(backLabel || showDisconnect) && (
        <div className="flex items-center gap-2">
          {backLabel && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
            >
              {backLabel}
            </button>
          )}
          {showDisconnect && (
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-lg border border-[var(--border)] bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white"
            >
              Se deconnecter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
