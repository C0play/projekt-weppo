import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";
import Card from "./components/Card";
import { GameState as SharedGameState } from "../shared/types";

const socket: Socket = io("http://localhost:3000", { autoConnect: false });

function App() {
  const [view, setView] = useState<"login" | "lobby" | "game">("login");
  const [nick, setNick] = useState("");
  const [gameIds, setGameIds] = useState<string[]>([]);
  const [gameState, setGameState] = useState<SharedGameState | null>(null);
  const [nickInput, setNickInput] = useState("");

  useEffect(() => {
    socket.on("connect", () => console.log("Connected"));

    socket.on("nick_status", (data: { available: boolean; nick: string }) => {
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

    socket.on("error", (err: { msg: string }) => alert(err.msg));

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
    socket.emit("add_game", nick);
  };

  const handleJoinGame = (gameId: string) => {
    socket.emit("join_game", nick, gameId);
  };

  if (view === "login") {
    return (
      <div className="app">
        <h1>Multiplayer Blackjack</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Enter nickname"
            value={nickInput}
            onChange={(e) => setNickInput(e.target.value)}
            style={{ padding: "10px", fontSize: "16px" }}
          />
          <button onClick={handleLogin}>Log In</button>
        </div>
      </div>
    );
  }

  if (view === "lobby") {
    return (
      <div className="app">
        <h1>Lobby ({nick})</h1>
        <div style={{ marginBottom: "20px" }}>
          <button onClick={handleCreateGame}>Create New Game</button>
          <button onClick={() => socket.emit("get_games")} style={{ marginLeft: "10px" }}>
            Refresh List
          </button>
        </div>
        <div className="game-list">
          {gameIds.length === 0 ? (
            <p>No games available</p>
          ) : (
            gameIds.map((id) => (
              <div
                key={id}
                style={{
                  margin: "10px",
                  padding: "10px",
                  border: "1px solid white",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "300px",
                }}
              >
                <span>Game {id.substring(0, 8)}... </span>
                <button onClick={() => handleJoinGame(id)}>Join</button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Room: {gameState?.uuid.substring(0, 8)}...</h1>
      <button onClick={() => setView("lobby")}>Back to Lobby</button>

      <div className="game-table">
        <div className="dealer-section">
          <h2>Dealer (Points: {gameState?.dealer.points})</h2>
          <div className="cards">
            {gameState?.dealer.cards.map((card, index) => (
              <Card key={index} card={card} />
            ))}
          </div>
        </div>

        <div
          className="players-container"
          style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center" }}
        >
          {gameState?.players.map((player) => (
            <div key={player.nick} className="player-section">
              <h2>
                {player.nick} {player.nick === nick ? "(You)" : ""} (Balance: {player.balance})
              </h2>
              {player.hands.map((hand, hIndex) => (
                <div key={hIndex} className="hand-section">
                  <p>
                    Bet: {hand.bet} | Points: {hand.points}
                  </p>
                  <div className="cards">
                    {hand.cards.map((card, cIndex) => (
                      <Card key={cIndex} card={card} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
