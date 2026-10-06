"use client";

import dynamic from "next/dynamic";
import React from "react";

const Game = dynamic(() => import("./game"), {
  ssr: false,
  loading: () => (
    <main className="join">
      <div className="card">
        <div className="logo">🌙</div>
        <h1>GC Hangout Hall</h1>
        <p>Loading the shared 3D room…</p>
      </div>
    </main>
  ),
});

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, message: error?.message || "The 3D client failed to load." };
  }

  componentDidCatch(error) {
    console.error("GC Hangout client error", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="join">
        <div className="card">
          <div className="logo">🌙</div>
          <h1>GC Hangout needs a reload</h1>
          <p>The 3D client hit a browser error. Your multiplayer session is preserved where possible.</p>
          <button className="enter" onClick={() => window.location.reload()}>
            Reload the hall
          </button>
          <div className="note">{this.state.message}</div>
        </div>
      </main>
    );
  }
}

export default function Page() {
  return (
    <AppErrorBoundary>
      <Game />
    </AppErrorBoundary>
  );
}
