import { useState, useEffect } from "react";
import { CalculatorForm } from "./components/CalculatorForm";
import { ResultBreakdown } from "./components/ResultBreakdown";
import { InsightsPanel } from "./components/InsightsPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { useFootprint } from "./hooks/useFootprint";

/**
 * Application shell: composes the calculator, results, insights, and history
 * panels around the `useFootprint` hook, which owns all async state.
 */
export default function App() {
  const { result, insights, entries, loading, saving, error, status, calculate, save } =
    useFootprint();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  return (
    <>
      <nav aria-label="Skip navigation">
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
      </nav>
      <header className="app-header">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          {theme === "light" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          )}
        </button>
        <h1>CarbonX</h1>
        <p>Understand, track, and reduce your carbon footprint with CarbonX.</p>
      </header>

      <main id="main">
        <CalculatorForm onSubmit={calculate} loading={loading} />

        <div role="alert" aria-live="assertive">
          {error && <p className="error">{error}</p>}
        </div>
        <p role="status" className="visually-hidden">
          {status}
        </p>

        {result && (
          <>
            <ResultBreakdown result={result} />
            {insights && <InsightsPanel insights={insights} />}
            <div className="card">
              <button className="btn secondary" onClick={save} disabled={saving} aria-busy={saving}>
                {saving ? "Saving…" : "Save this entry to my history"}
              </button>
            </div>
          </>
        )}

        <HistoryPanel entries={entries} />
      </main>

      <footer className="app-footer">
        <p>
          Built with React &amp; TypeScript. Estimate your emissions, get personalized
          recommendations, and track your progress over time.
        </p>
        <p className="developer-credit">
          Built by{" "}
          <a
            href="https://github.com/nishnarudkar"
            target="_blank"
            rel="noopener noreferrer"
          >
            Nishant Narudkar
          </a>
        </p>
      </footer>
    </>
  );
}
