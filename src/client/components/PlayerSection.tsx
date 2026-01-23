import { CSSProperties, useEffect, useState } from "react";
import Card from "./Card";
import { Player } from "../../game/types";
import "./PlayerSection.css";

interface PlayerSectionProps {
  player: Player;
  isCurrentUser: boolean;
  style?: CSSProperties;
  activeHandIndex?: number;
}

const PlayerSection = ({ player, isCurrentUser, style, activeHandIndex }: PlayerSectionProps) => {
  const [selectedHandIdx, setSelectedHandIdx] = useState(0);

  // If this player is currently playing, switch to the active hand automatically
  useEffect(() => {
    if (activeHandIndex !== undefined && activeHandIndex >= 0 && activeHandIndex < player.hands.length) {
      setSelectedHandIdx(activeHandIndex);
    }
  }, [activeHandIndex, player.hands.length]);

  // Fallback if selected index is out of bounds (mock updates, etc)
  const safeHandIndex = selectedHandIdx < player.hands.length ? selectedHandIdx : 0;

  // If undefined/empty hand array (shouldn't happen in game but maybe lobby), handle safely
  const currentHand = player.hands[safeHandIndex];

  if (!currentHand) {
    return (
      <div className={`player-section ${isCurrentUser ? "current-user" : ""}`} style={style}>
        <h2>{player.nick}</h2>
        <p>Waiting...</p>
      </div>
    );
  }

  const isAllIn = player.balance === 0 && currentHand.bet > 0;
  const hasMultipleHands = player.hands.length > 1;

  return (
    <div className={`player-section ${isCurrentUser ? "current-user" : ""}`} style={style}>
      <h2>
        {player.nick} {isCurrentUser ? "(You)" : ""}
      </h2>

      {hasMultipleHands && (
        <div className="hand-selector">
          {player.hands.map((_, idx) => (
            <button
              key={idx}
              className={`hand-btn ${idx === safeHandIndex ? "active" : ""}`}
              onClick={() => setSelectedHandIdx(idx)}
              title={`View hand ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      )}

      <div className="hand-section">
        <p>
          Bet: <span className={isAllIn ? "all-in-bet" : ""}>{currentHand.bet}</span> | Points: {currentHand.points}
        </p>
        <div className="cards">
          {currentHand.cards.map((card, cIndex) => (
            <Card key={cIndex} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlayerSection;
