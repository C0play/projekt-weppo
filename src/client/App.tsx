import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

import "./App.css";
import Card from "./components/Card";
import PlayerSection from "./components/PlayerSection";

import { GameState as SharedGameState, PlayerState, GamePhase } from "../game/types";
import { Action } from "../shared/types";
import { Config } from "../shared/config";

const socket: Socket = io("http://" + Config.CLIENT_IP + ":" + Config.CLIENT_PORT, { autoConnect: false });

interface LoginRequest {
  nick: string;
  token: string | null;
}

interface LoginResponse {
  success: boolean;
  msg: string;
  nick?: string;
  token?: string;
  restored?: boolean;
}

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
  const [token, setToken] = useState<string | null>(null);
  const [gameIds, setGameIds] = useState<string[]>([]);
  const [gameState, setGameState] = useState<SharedGameState | null>(null);
  const [nickInput, setNickInput] = useState("");
  const [betAmount, setBetAmount] = useState(100);

  const runTestMode = () => {
    setNick("TestPlayer");
    setGameState(mockGameState);
    setView("game");
  };

  useEffect(() => {
    socket.on("connect", () => console.log("Connected"));

    socket.on("login_response", (data: LoginResponse) => {
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
          socket.disconnect();
        }
      }
    });

    socket.on("game_ids", (data: { id: string[] }) => {
      if (data && "id" in data) setGameIds(data.id);
    });

    socket.on("game_added", (game: SharedGameState) => {
      setGameState(game);
      setView("game");
    });

    socket.on("game", (game: SharedGameState) => {
      setGameState(game);
      setView("game");
    });
    socket.on("your_turn", (data: { allowedMoves: Action[]; time_left: number }) => {
      console.log("It's my turn!", data);
      // We could store time_left or allowedMoves here, but since the server also emits 'game',
      // we might rely on game state. However, 'your_turn' is the trigger for specific client-side
      // timers or notifications.
      // For now, let's just ensure we know it's our turn visually or via audio if we added it.
    });
    socket.on("error", (err: string | { msg: string }) => {
      const msg = typeof err === "string" ? err : err.msg;
      alert(msg);
    });

    const savedToken = localStorage.getItem("player_token");
    const savedNick = localStorage.getItem("player_nick");
    if (savedToken && savedNick) {
      setNickInput(savedNick);
      // Auto-connect
      socket.connect();
      socket.emit("login", { nick: savedNick, token: savedToken });
    }

    return () => {
      socket.off("connect");
      socket.off("login_response");
      socket.off("game_ids");
      socket.off("game_added");
      socket.off("game");
      socket.off("your_turn");
      socket.off("error");
    };
  }, []);

  const handleLogin = () => {
    if (!nickInput) return;

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

  const handleJoinGame = (gameId: string) => {
    socket.emit("join_game", { id: gameId });
  };

  // Helper to position players in an arc
  const getPlayerStyle = (index: number, total: number) => {
    // Basic arc calculation
    // We want the center players to be lower (closer to bottom edge)
    // and side players to be higher (closer to dealer)
    const centerIndex = (total - 1) / 2;
    const distanceFromCenter = Math.abs(index - centerIndex);

    // Parabolic arch: y = x^2
    const yOffset = -(Math.pow(distanceFromCenter, 2) * 20); // Move Up as we go out
    // No rotation, parallel to screen as requested

    return {
      transform: `translateY(${yOffset}px)`,
      zIndex: 10 - distanceFromCenter, // Center on top? Or sides? Usually doesn't matter much.
    };
  };

  if (view === "login") {
    return (
      <div className="app">
        <h1>Multiplayer Blackjack</h1>
        <div className="login-container">
          <input
            type="text"
            placeholder="Enter nickname"
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
            className="login-input"
          />
          <button onClick={handleLogin}>Log In</button>
          <button onClick={runTestMode} style={{ marginTop: "10px", backgroundColor: "#555" }}>
            Test Mode (No Server)
          </button>
        </div>
      </div>
    );
  }

  if (view === "lobby") {
    return (
      <div className="app">
        <h1>Lobby ({nick})</h1>
        <div className="lobby-controls">
          <button onClick={handleCreateGame}>Create New Game</button>
          <button onClick={() => socket.emit("get_games")} className="lobby-refresh-btn">
            Refresh List
          </button>
        </div>
        <div className="game-list">
          {gameIds.length === 0 ? (
            <p>No games available</p>
          ) : (
            gameIds.map((id, index) => (
              <div key={`${id}-${index}`} className="game-list-item">
                <span>Game {id.substring(0, 8)}... </span>
                <button onClick={() => handleJoinGame(id)}>Join</button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (!gameState) {
    return <div className="app">Loading game state...</div>;
  }

  const isMyTurn = gameState.players[gameState.turn.player_idx]?.nick === nick;
  const validMoves = gameState.turn.validMoves.map((m) => Action.toLowerCase(m));
  const currentPlayer = gameState.players.find((p) => p.nick === nick);
  const currentBalance = currentPlayer?.balance || 0;

  return (
    <div className="app">
      {/* Game Controls */}
      <div className="game-controls">
        <h3 className={isMyTurn ? "my-turn" : ""}>
          {isMyTurn
            ? "It's your turn!"
            : `Current turn: ${gameState.players[gameState.turn.player_idx]?.nick || "Unknown"}`}
        </h3>
        {isMyTurn && (
          <div className="game-controls-buttons">
            {validMoves.includes("bet") ? (
              <div className="betting-controls">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(parseInt(e.target.value))}
                  className="bet-input"
                  min="10"
                />
                <button onClick={() => socket.emit("action", Action.BET, betAmount)} className="control-btn btn-bet">
                  BET {betAmount}
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => validMoves.includes("hit") && socket.emit("action", Action.HIT)}
                  className={`control-btn btn-hit ${!validMoves.includes("hit") ? "disabled" : ""}`}
                >
                  HIT
                </button>
                <button
                  onClick={() => validMoves.includes("stand") && socket.emit("action", Action.STAND)}
                  className={`control-btn btn-stand ${!validMoves.includes("stand") ? "disabled" : ""}`}
                >
                  STAND
                </button>
                <button
                  onClick={() => validMoves.includes("double") && socket.emit("action", Action.DOUBLE)}
                  className={`control-btn btn-double ${!validMoves.includes("double") ? "disabled" : ""}`}
                >
                  DOUBLE
                </button>
                <button
                  onClick={() => validMoves.includes("split") && socket.emit("action", Action.SPLIT)}
                  className={`control-btn btn-split ${!validMoves.includes("split") ? "disabled" : ""}`}
                >
                  SPLIT
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="game-table">
        <button className="exit-btn" onClick={() => setView("lobby")}>
          EXIT ROOM
        </button>
        <div className="room-info">
          <div>Room: Active Game</div>
          <div className="balance-info">
            Balance: <span className="money">${currentBalance}</span>
          </div>
        </div>

        <div className="dealer-section">
          <h2>Dealer (Points: {gameState.dealer.points})</h2>
          <div className="cards">
            {gameState.dealer.cards.map((card, index) => (
              <Card key={index} card={card} />
            ))}
          </div>
        </div>

        <div className="players-wrapper">
          {gameState.players.map((player, index) => (
            <PlayerSection
              key={`${player.nick}-${index}`}
              player={player}
              isCurrentUser={player.nick === nick}
              style={getPlayerStyle(index, gameState.players.length)}
              activeHandIndex={gameState.turn.player_idx === player.player_idx ? gameState.turn.hand_idx : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
