"use client";

import dynamic from "next/dynamic";

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

export default function Page() {
  return <Game />;
}
