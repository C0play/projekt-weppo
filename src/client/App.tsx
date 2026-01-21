import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

import "./App.css";
import Card from "./components/Card";
import PlayerSection from "./components/PlayerSection";

import { GameState as SharedGameState, PlayerState, GamePhase } from "../game/types";
import { Action } from "../shared/types";
import { Config } from "../shared/config";



const socket: Socket = io("http://" + Config.CLIENT_IP + ":" + Config.CLIENT_PORT, { autoConnect: false });


// MOCK DATA FOR TESTING WITHOUT SERVER
const mockGameState: SharedGameState = {
  uuid: "test-game-1234",
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
          cards: [
            { rank: "king", suit: "diamonds", point: 10 },
            { rank: "9", suit: "spades", point: 9 },
          ],
        },
        {
          bet: 100,
          points: 18,
          number_of_full_aces: 0,
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
  const [gameIds, setGameIds] = useState<string[]>([]);
  const [gameState, setGameState] = useState<SharedGameState | null>(null);
  const [nickInput, setNickInput] = useState("");

  const runTestMode = () => {
    setNick("TestPlayer");
    setGameState(mockGameState);
    setView("game");
  };

  useEffect(() => {
    socket.on("connect", () => console.log("Connected"));

    socket.on("nick_status", (data: { available: boolean; nick: string; }) => {
      if (data.available) {
        setNick(data.nick);
        setView("lobby");
        socket.emit("get_games");
      } else {
        alert("Nick is taken!");
        socket.disconnect();
      }
    });

    socket.on("game_ids", (ids: string[]) => setGameIds(ids));

    socket.on("game_added", (game: SharedGameState) => {
      setGameState(game);
      setView("game");
    });

    socket.on("game", (game: SharedGameState) => {
      setGameState(game);
      setView("game");
    });

    socket.on("error", (err: { msg: string; }) => alert(err.msg));

    return () => {
      socket.off("connect");
      socket.off("nick_status");
      socket.off("game_ids");
      socket.off("game_added");
      socket.off("game");
      socket.off("error");
    };
  }, []);

  const handleLogin = () => {
    if (!nickInput) return;
    socket.connect();
    socket.emit("create_nick", nickInput);
  };

  const handleCreateGame = () => {
    socket.emit("create_game", nick);
  };

  const handleJoinGame = (gameId: string) => {
    socket.emit("join_game", nick, gameId);
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
            <button
              onClick={() => validMoves.includes("hit") && socket.emit("hit", gameState.uuid)}
              className={`control-btn btn-hit ${!validMoves.includes("hit") ? "disabled" : ""}`}
            >
              HIT
            </button>
            <button
              onClick={() => validMoves.includes("stand") && socket.emit("stand", gameState.uuid)}
              className={`control-btn btn-stand ${!validMoves.includes("stand") ? "disabled" : ""}`}
            >
              STAND
            </button>
            <button
              onClick={() => validMoves.includes("double") && socket.emit("double", gameState.uuid)}
              className={`control-btn btn-double ${!validMoves.includes("double") ? "disabled" : ""}`}
            >
              DOUBLE
            </button>
            <button
              onClick={() => validMoves.includes("split") && socket.emit("split", gameState.uuid)}
              className={`control-btn btn-split ${!validMoves.includes("split") ? "disabled" : ""}`}
            >
              SPLIT
            </button>
          </div>
        )}
      </div>

      <div className="game-table">
        <button className="exit-btn" onClick={() => setView("lobby")}>
          EXIT ROOM
        </button>
        <div className="room-info">
          <div>Room: {gameState.uuid.substring(0, 8)}...</div>
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
