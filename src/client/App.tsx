import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

import "./App.css";

// Components
import LoginView from "./components/LoginView";
import LobbyView from "./components/LobbyView";
import GameView from "./components/GameView";

import { GameState as SharedGameState } from "../game/types";
import { Action } from "../shared/types";
import { Config } from "../shared/config";
import { LoginRequest, LoginResponse, RoomRequest, RoomsResponse } from "../server/types";

// NOTE: Ideally socket should be in a separate context or service,
// but sticking to existing pattern for this refactor.
const socket: Socket = io("http://" + Config.CLIENT_IP + ":" + Config.CLIENT_PORT, { autoConnect: false });

function App() {
  const [view, setView] = useState<"login" | "lobby" | "game">("login");
  const [nick, setNick] = useState("");
  const [_, setToken] = useState<string | null>(null);
  const [gameIds, setGameIds] = useState<string[]>([]);
  const [gameState, setGameState] = useState<SharedGameState | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);

  const handleLoginResponse = (data: LoginResponse) => {
    console.log("Login response:", data);
    if (data.success && data.nick) {
      setNick(data.nick);
      if (data.token) {
        setToken(data.token);
        localStorage.setItem("player_token", data.token);
        localStorage.setItem("player_nick", data.nick);
      }
      setView("lobby");
      socket.emit("get_games");
    } else {
      alert(data.msg || "Login failed");
      if (!data.success) {
        // allow retry
        socket.disconnect();
      }
    }
  };

  useEffect(() => {
    const handleConnect = () => console.log("Connected");
    const handleGameIds = (data: RoomsResponse) => {
      if (data && "id" in data) setGameIds(data.id);
    };
    const handleGameUpdate = (game: SharedGameState) => {
      setGameState(game);
      setView("game");
    };
    const handleYourTurn = (data: { allowedMoves: Action[]; time_left: number }) => {
      console.log("Your turn!", data);
      setDeadline(data.time_left);
    };
    const handleError = (err: string | { msg: string }) => {
      const msg = typeof err === "string" ? err : err.msg;
      alert(msg);
    };
    const handleKick = (data: { reason: string; room_id: string }) => {
      console.log("Kicked from room:", data);
      alert(`You were kicked from the game: ${data.reason}`);
      setGameState(null);
      setDeadline(null);
      setView("lobby");
      socket.emit("get_games");
    };

    socket.on("connect", handleConnect);
    socket.on("login_response", handleLoginResponse);
    socket.on("game_ids", handleGameIds);
    socket.on("game", handleGameUpdate);
    socket.on("your_turn", handleYourTurn);
    socket.on("error", handleError);
    socket.on("kick", handleKick);

    // Attempt auto-login if token exists
    const savedToken = localStorage.getItem("player_token");
    const savedNick = localStorage.getItem("player_nick");
    if (savedToken && savedNick) {
      socket.connect();
      socket.emit("login", { nick: savedNick, token: savedToken });
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("login_response", handleLoginResponse);
      socket.off("game_ids", handleGameIds);
      socket.off("game", handleGameUpdate);
      socket.off("your_turn", handleYourTurn);
      socket.off("error", handleError);
      socket.off("kick", handleKick);
    };
  }, []);

  // --- Callbacks for Child Components ---

  const handleLogin = (nickInput: string) => {
    // Check if we are restoring a session for this nick
    const savedToken = localStorage.getItem("player_token");
    const savedNick = localStorage.getItem("player_nick");
    const tokenToSend = savedNick === nickInput ? savedToken : null;

    socket.connect();
    const req: LoginRequest = { nick: nickInput, token: tokenToSend };
    socket.emit("login", req);
  };

  const handleCreateGame = () => {
    socket.emit("create_game");
  };

  const handleRefreshList = () => {
    socket.emit("get_games");
  };

  const handleJoinGame = (gameId: string) => {
    const req: RoomRequest = { id: gameId };
    socket.emit("join_game", req);
  };

  const handleExitGame = () => {
    setView("lobby");
    // Optionally emit a leave room event if server supports it
    // socket.emit("leave_game");
  };

  // --- Render ---

  if (view === "login") {
    return (
      <div className="app">
        <h1
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            color: "#ffd700",
            textShadow: "0 0 20px rgba(212, 175, 55, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          Multiplayer Blackjack
        </h1>
        <LoginView onLogin={handleLogin} />
      </div>
    );
  }

  if (view === "lobby") {
    return (
      <div className="app">
        <LobbyView
          nick={nick}
          gameIds={gameIds}
          onCreateGame={handleCreateGame}
          onRefreshList={handleRefreshList}
          onJoinGame={handleJoinGame}
        />
      </div>
    );
  }

  if (!gameState) {
    return <div className="app">Loading game state...</div>;
  }

  return (
    <div className="app">
      <GameView socket={socket} gameState={gameState} nick={nick} deadline={deadline} onExit={handleExitGame} />
    </div>
  );
}

export default App;
