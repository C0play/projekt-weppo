import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { GameState, GamePhase } from "../../game/types";
import Card from "./Card";
import CardBack from "./CardBack";
import PlayerSection from "./PlayerSection";
import GameControls from "./GameControls";
import "./GameView.css";

interface GameViewProps {
  socket: Socket;
  gameState: GameState;
  nick: string;
  deadline: number | null;
  onExit: () => void;
}

export default function GameView({ socket, gameState, nick, deadline, onExit }: GameViewProps) {
  const currentPlayer = gameState.players.find((p) => p.nick === nick);
  const currentBalance = currentPlayer?.balance || 0;

  // State for animated dealer card reveal
  const [dealerTotalVisible, setDealerTotalVisible] = useState(1); // Total cards shown (including backs)
  const [dealerRevealedCount, setDealerRevealedCount] = useState(1); // Cards that are face-up
  const [showResults, setShowResults] = useState(false); // Show results only after all dealer cards revealed

  // Oblicz punkty tylko dla odkrytych kart dealera
  const revealedDealerPoints = gameState.dealer.cards
    .slice(0, dealerRevealedCount)
    .reduce((sum, card) => sum + card.point, 0);

  // Animate dealer card reveal when entering RESULTS phase
  useEffect(() => {
    if (gameState.game_phase === GamePhase.RESULTS) {
      const totalCards = gameState.dealer.cards.length;
      setDealerTotalVisible(1); // Start with first card
      setDealerRevealedCount(1); // First card is revealed
      setShowResults(false); // Hide results initially

      const timers: NodeJS.Timeout[] = [];

      // For each additional card (starting from second)
      for (let i = 2; i <= totalCards; i++) {
        const cardIndex = i;

        // Show card back first
        const showBackTimer = setTimeout(
          () => {
            setDealerTotalVisible(cardIndex);
          },
          (cardIndex - 2) * 500,
        ); // Each card appears 0.5s after previous is revealed

        // Reveal card after 0.25s
        const revealTimer = setTimeout(
          () => {
            setDealerRevealedCount(cardIndex);
          },
          (cardIndex - 2) * 500 + 250,
        ); // 0.25s after card back appears

        timers.push(showBackTimer, revealTimer);
      }

      // Show results after all cards are revealed
      const showResultsTimer = setTimeout(
        () => {
          setShowResults(true);
        },
        (totalCards - 2) * 500 + 250,
      ); // After last card is revealed
      timers.push(showResultsTimer);

      return () => timers.forEach((timer) => clearTimeout(timer));
    } else if (gameState.game_phase === GamePhase.PLAYING) {
      // During PLAYING, only show first dealer card
      setDealerTotalVisible(1);
      setDealerRevealedCount(1);
      setShowResults(false);
    } else {
      // BETTING phase - show all cards
      setDealerTotalVisible(gameState.dealer.cards.length);
      setDealerRevealedCount(gameState.dealer.cards.length);
      setShowResults(false);
    }
  }, [gameState.game_phase, gameState.dealer.cards.length]);

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
      <GameControls socket={socket} gameState={gameState} nick={nick} deadline={deadline} />

      <div className="game-table">
        <button className="exit-btn" onClick={onExit}>
          EXIT ROOM
        </button>
        <div className="room-info">
          {/*  <div>Room: {curr_room_id}</div> */}
          <div className="balance-info">
            Balance: <span className="money">${currentBalance}</span>
          </div>
        </div>

        <div className="dealer-section">
          <h2>Dealer (Points: {showResults ? gameState.dealer.points : revealedDealerPoints})</h2>
          <div className="cards">
            {/* Render cards based on visibility and reveal status */}
            {gameState.dealer.cards.slice(0, dealerTotalVisible).map((card, index) => {
              // If this card has been revealed, show it face-up
              if (index < dealerRevealedCount) {
                return <Card key={index} card={card} />;
              }
              // Otherwise show card back (waiting to be revealed)
              return <CardBack key={`hidden-${index}`} />;
            })}
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
              gamePhase={gameState.game_phase}
              dealer={gameState.dealer}
              showResults={showResults}
            />
          ))}
        </div>
      </div>
    </>
  );
}
