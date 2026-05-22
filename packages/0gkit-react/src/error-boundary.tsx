"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ZeroGError } from "@foundryprotocol/0gkit-core";

export interface ZeroGErrorBoundaryProps {
  children: ReactNode;
  /** Optional render override. Receives the caught error. */
  fallback?: (error: Error) => ReactNode;
  /** Optional side-effect (e.g. analytics) when an error is caught. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * React error boundary that renders a help link for `ZeroGError`s thrown
 * inside its subtree. For non-ZeroGError, renders a generic fallback with
 * just the message (no helpUrl). Pass `fallback` to fully customize.
 */
export class ZeroGErrorBoundary extends Component<ZeroGErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error);

    if (error instanceof ZeroGError) {
      return (
        <div
          role="alert"
          style={{
            padding: 16,
            border: "1px solid #c00",
            borderRadius: 4,
            background: "#fff5f5",
            color: "#333",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>{error.code}</strong>
          <p style={{ margin: "4px 0" }}>{error.message}</p>
          <p style={{ margin: "4px 0", opacity: 0.8 }}>{error.hint}</p>
          <a
            href={error.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#c00", textDecoration: "underline" }}
          >
            How to fix →
          </a>
        </div>
      );
    }
    return (
      <div
        role="alert"
        style={{
          padding: 16,
          border: "1px solid #c00",
          borderRadius: 4,
          background: "#fff5f5",
          color: "#333",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <strong style={{ display: "block", marginBottom: 4 }}>Unexpected error</strong>
        <p style={{ margin: "4px 0" }}>{error.message}</p>
      </div>
    );
  }
}
