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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Passer en mode jour" : "Passer en mode nuit"}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--panel)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
          }}
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
        <h2 style={{ margin: 0 }}>Simulation Monte Carlo</h2>
      </div>

      {(backLabel || showDisconnect) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {backLabel && onBack && (
            <button
              onClick={onBack}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {backLabel}
            </button>
          )}
          {showDisconnect && (
            <button
              onClick={onDisconnect}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--btnBg)",
                color: "var(--btnText)",
                cursor: "pointer",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              Se déconnecter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
