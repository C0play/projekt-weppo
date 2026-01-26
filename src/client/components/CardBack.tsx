import React from "react";
import "./Card.css";

interface CardBackProps {
  className?: string;
}

const CardBack: React.FC<CardBackProps> = ({ className }) => {
  return (
    <div className={"card" + (className ? ` ${className}` : "")}>
      <img src="/assets/cards/card_reverse_2.svg.png" alt="Card back" />
    </div>
  );
};

export default CardBack;
