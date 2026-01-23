import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

import "./App.css";

// Components
import LoginView from "./components/LoginView";
import LobbyView from "./components/LobbyView";
import GameView from "./components/GameView";

import { GameState as SharedGameState, PlayerState, GamePhase } from "../game/types";
import { Action } from "../shared/types";
import { Config } from "../shared/config";
import { LoginRequest, LoginResponse, RoomRequest, RoomsResponse } from "../server/types";

// NOTE: Ideally socket should be in a separate context or service,
// but sticking to existing pattern for this refactor.
const socket: Socket = io("http://" + Config.CLIENT_IP + ":" + Config.CLIENT_PORT, { autoConnect: false });

// MOCK DATA FOR TESTING WITHOUT SERVER
const mockGameState: SharedGameState = {
  number_of_players: 4,
  max_players: 4,
  game_phase: GamePhase.PLAYING,
  turn: { player_idx: 0, hand_idx: 0, timestamp: Date.now(), validMoves: [Action.HIT, Action.STAND, Action.DOUBLE] },
  dealer: {
    cards: [
      { rank: "ace", suit: "spades", point: 11 },
      { rank: "king", suit: "hearts", point: 10 },
    ],
    points: 21,
    number_of_full_aces: 1,
  },
  players: [
    {
      nick: "TestPlayer",
      balance: 1000,
      player_idx: 0,
      player_state: PlayerState.ACTIVE,
      hands: [
        {
          bet: 50,
          points: 13,
          number_of_full_aces: 0,
          is_insured: false,
          cards: [
            { rank: "10", suit: "clubs", point: 10 },
            { rank: "3", suit: "diamonds", point: 3 },
          ],
        },
      ],
    },
    {
      nick: "Bot1",
      balance: 800,
      player_idx: 1,
      player_state: PlayerState.ACTIVE,
      hands: [
        {
          bet: 100,
          points: 19,
          number_of_full_aces: 0,
          is_insured: false,
          cards: [
            { rank: "king", suit: "diamonds", point: 10 },
            { rank: "9", suit: "spades", point: 9 },
          ],
        },
      ],
    },
    {
      nick: "Bot2",
      balance: 800,
      player_idx: 2,
      player_state: PlayerState.ACTIVE,
      hands: [
        {
          bet: 100,
          points: 19,
          number_of_full_aces: 0,
          is_insured: false,
          cards: [
            { rank: "king", suit: "diamonds", point: 10 },
            { rank: "9", suit: "spades", point: 9 },
          ],
        },
        {
          bet: 100,
          points: 18,
          number_of_full_aces: 0,
          is_insured: false,
          cards: [
            { rank: "8", suit: "clubs", point: 8 },
            { rank: "queen", suit: "diamonds", point: 10 },
          ],
        },
      ],
    },
    {
      nick: "Bot4",
      balance: 0,
      player_idx: 3,
      player_state: PlayerState.ACTIVE,
      hands: [
        {
          bet: 100,
          points: 19,
          number_of_full_aces: 0,
          is_insured: false,
          cards: [
            { rank: "king", suit: "diamonds", point: 10 },
            { rank: "9", suit: "spades", point: 9 },
          ],
        },
      ],
    },
  ],
};

function App() {
  const [view, setView] = useState<"login" | "lobby" | "game">("login");
  const [nick, setNick] = useState("");
  const [_, setToken] = useState<string | null>(null);
  const [gameIds, setGameIds] = useState<string[]>([]);
  const [gameState, setGameState] = useState<SharedGameState | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const runTestMode = () => {
    setNick("TestPlayer");
    setGameState(mockGameState);
    setView("game");
  };

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
      // time_left is a deadline (timestamp), calculate remaining seconds
      const remainingMs = data.time_left - Date.now();
      const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
      setTimeLeft(remainingSeconds);
    };
    const handleError = (err: string | { msg: string }) => {
      const msg = typeof err === "string" ? err : err.msg;
      alert(msg);
    };

    socket.on("connect", handleConnect);
    socket.on("login_response", handleLoginResponse);
    socket.on("game_ids", handleGameIds);
    socket.on("game", handleGameUpdate);
    socket.on("your_turn", handleYourTurn);
    socket.on("error", handleError);

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
        <h1>Multiplayer Blackjack</h1>
        <LoginView onLogin={handleLogin} onRunTestMode={runTestMode} />
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
      <GameView socket={socket} gameState={gameState} nick={nick} timeLeft={timeLeft} onExit={handleExitGame} />
    </div>
  );
}

export default App;
