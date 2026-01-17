import { useState } from "react";
import "./App.css";
import React from "react";
import Card from "./components/Card";
import { Card as CardType } from "../shared/types";

const playerCards: CardType[] = [
  { suit: "H", rank: "A", value: 11 },
  { suit: "S", rank: "K", value: 10 },
];

const dealerCards: CardType[] = [
  { suit: "D", rank: "Q", value: 10 },
  { suit: "C", rank: "2", value: 2 },
];

function App() {
  return (
    <div className="app">
      <h1>Multiplayer Blackjack</h1>
      <div className="game-table">
        <div className="dealer-section">
          <h2>Dealer</h2>
          <div className="cards">
            {dealerCards.map((card, index) => (
              <Card key={index} card={card} />
            ))}
          </div>
        </div>
        <div className="player-section">
          <h2>Player</h2>
          <div className="cards">
            {playerCards.map((card, index) => (
              <Card key={index} card={card} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
