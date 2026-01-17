import React from "react";
import { Card as CardType } from "../../shared/types";
import "./Card.css";

interface CardProps {
  card: CardType;
}

const Card: React.FC<CardProps> = ({ card }) => {
  const { suit, rank } = card;

  const imageName = `English_pattern_${rank}_of_${suit}.svg.png`;
  const imageSrc = `/assets/cards/${imageName}`;

  return (
    <div className="card">
      <img src={imageSrc} alt={`${rank} of ${suit}`} />
    </div>
  );
};

export default Card;
