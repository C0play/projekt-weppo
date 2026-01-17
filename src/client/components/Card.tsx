import React from "react";
import { Card as CardType } from "../../shared/types";
import "./Card.css";

interface CardProps {
  card: CardType;
}

const Card: React.FC<CardProps> = ({ card }) => {
  const { suit, rank } = card;

  const suitNames: Record<string, string> = {
    H: "hearts",
    D: "diamonds",
    C: "clubs",
    S: "spades",
  };

  const rankNames: Record<string, string> = {
    A: "ace",
    K: "king",
    Q: "queen",
    J: "jack",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    "10": "10",
  };

  const imageName = `English_pattern_${rankNames[rank]}_of_${suitNames[suit]}.svg.png`;
  const imageSrc = `/assets/cards/${imageName}`;

  return (
    <div className="card">
      <img src={imageSrc} alt={`${rank} of ${suitNames[suit]}`} />
    </div>
  );
};

export default Card;
