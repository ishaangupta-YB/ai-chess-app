import { useEffect, useRef, useState } from "react";
import { useAgent } from "agents/react";
import { createRoot } from "react-dom/client";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import type { State as ServerState } from "./chess";

function usePlayerId() {
  const [pid] = useState(() => {
    const existing = localStorage.getItem("playerId");
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem("playerId", id);
    return id;
  });
  return pid;
}

function App() {
  const playerId = usePlayerId();
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameIdInput, setGameIdInput] = useState("");
  const [menuError, setMenuError] = useState<string | null>(null);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [myColor, setMyColor] = useState<"w" | "b" | "spectator">("spectator");
  const [pending, setPending] = useState(false);
  const [serverState, setServerState] = useState<ServerState | null>(null);
  const [joined, setJoined] = useState(false);

  const host = window.HOST ?? "http://localhost:5173/";

  const { stub } = useAgent<ServerState>({
    host,
    name: gameId ?? "__lobby__",
    agent: "chess",
    onStateUpdate: (s) => {
      if (!gameId) return;
      gameRef.current.load(s.board);
      setFen(s.board);
      setServerState(s);
    }
  });

  useEffect(() => {
    if (!gameId || joined) return;

    (async () => {
      try {
        const res = await stub.join({ playerId, preferred: "any" });
        if (!res?.ok) return;

        setMyColor(res.role);
        gameRef.current.load(res.state.board);
        setFen(res.state.board);
        setServerState(res.state);
        setJoined(true);
      } catch (error) {
        console.error("Failed to join game", error);
      }
    })();
  }, [playerId, gameId, stub, joined]);

  async function handleStartNewGame() {
    const newId = crypto.randomUUID();
    setGameId(newId);
    setGameIdInput(newId);
    setMenuError(null);
    setJoined(false);
  }

  async function handleJoinGame() {
    const trimmed = gameIdInput.trim();
    if (!trimmed) {
      setMenuError("Enter a game ID to join.");
      return;
    }
    setGameId(trimmed);
    setMenuError(null);
    setJoined(false);
  }

  const handleHelpClick = () => {
    window.openai?.sendFollowUpMessage?.({
      prompt: `Help me with my chess game. I am playing as ${myColor} and the board is: ${fen}. Please only offer written advice.`
    });
  };

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    if (!gameId || !sourceSquare || !targetSquare || pending) return false;

    const game = gameRef.current;
    if (myColor === "spectator" || game.turn() !== myColor) return false;

    const piece = game.get(sourceSquare as Square);
    if (!piece || piece.color !== myColor) return false;

    const prevFen = game.fen();

    try {
      const local = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!local) return false;
    } catch {
      return false;
    }

    const nextFen = game.fen();
    setFen(nextFen);
    setPending(true);

    stub
      .move({ from: sourceSquare, to: targetSquare, promotion: "q" }, prevFen)
      .then((r: { ok: boolean; fen: string; reason?: string; status?: string; san?: string }) => {
        if (!r.ok) {
          game.load(r.fen);
          setFen(r.fen);
        }
      })
      .finally(() => setPending(false));

    return true;
  }

  return (
    <div style={{ padding: "20px", background: "#f8fafc", minHeight: "100vh" }}>
      {!gameId ? (
        <div style={{ maxWidth: "420px", margin: "0 auto", background: "#fff", borderRadius: "16px", padding: "24px" }}>
          <h1>Ready to play?</h1>
          <p>Start a new match or join an existing game.</p>
          <button onClick={handleStartNewGame} style={{ padding: "12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%" }}>
            Start a new game
          </button>
          <div style={{ marginTop: "16px" }}>
            <input
              placeholder="Paste a game ID"
              value={gameIdInput}
              onChange={(e) => setGameIdInput(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
            />
            <button onClick={handleJoinGame} style={{ marginTop: "8px", padding: "10px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", width: "100%" }}>
              Join
            </button>
            {menuError && <p style={{ color: "red", fontSize: "0.85rem" }}>{menuError}</p>}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", marginBottom: "16px" }}>
            <h2>Game {gameId}</h2>
            <p>Status: {serverState?.status}</p>
            <button onClick={handleHelpClick} style={{ padding: "10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>
              Ask for help
            </button>
          </div>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "16px" }}>
            <Chessboard
              position={fen}
              onPieceDrop={onPieceDrop}
              boardOrientation={myColor === "b" ? "black" : "white"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
