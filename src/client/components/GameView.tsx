import { Socket } from "socket.io-client";
import { GameState } from "../../game/types";
import Card from "./Card";
import PlayerSection from "./PlayerSection";
import GameControls from "./GameControls";
import "./GameView.css";

interface GameViewProps {
  socket: Socket;
  gameState: GameState;
  nick: string;
  timeLeft: number | null;
  onExit: () => void;
}

export default function GameView({ socket, gameState, nick, timeLeft, onExit }: GameViewProps) {
  const currentPlayer = gameState.players.find((p) => p.nick === nick);
  const currentBalance = currentPlayer?.balance || 0;

  // Helper to position players in an arc (moved from App.tsx)
  const getPlayerStyle = (index: number, total: number) => {
    const centerIndex = (total - 1) / 2;
    const distanceFromCenter = Math.abs(index - centerIndex);
    const yOffset = -(Math.pow(distanceFromCenter, 2) * 20);

    return {
      transform: `translateY(${yOffset}px)`,
      zIndex: 10 - distanceFromCenter,
    };
  };

  return (
    <>
      <GameControls socket={socket} gameState={gameState} nick={nick} timeLeft={timeLeft} />

      <div className="game-table">
        <button className="exit-btn" onClick={onExit}>
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
    </>
  );
}
