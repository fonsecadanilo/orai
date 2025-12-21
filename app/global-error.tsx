"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
            backgroundColor: "#0a0a0a",
            color: "#fafafa",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#ef4444",
                marginBottom: "0.5rem",
              }}
            >
              Erro crítico!
            </h2>
            <p
              style={{
                color: "#a1a1aa",
                marginBottom: "1.5rem",
              }}
            >
              A aplicação encontrou um erro crítico e precisa ser recarregada.
            </p>

            <button
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: "500",
                color: "#0a0a0a",
                backgroundColor: "#fafafa",
                borderRadius: "0.375rem",
                border: "none",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#e4e4e7")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#fafafa")
              }
            >
              Recarregar aplicação
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}














