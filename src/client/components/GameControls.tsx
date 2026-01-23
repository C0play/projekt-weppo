import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { GameState, GamePhase } from "../../game/types";
import { Action } from "../../shared/types";
import "./GameControls.css";

interface GameControlsProps {
  socket: Socket;
  gameState: GameState;
  nick: string;
  timeLeft: number | null;
}

export default function GameControls({ socket, gameState, nick, timeLeft }: GameControlsProps) {
  const [betAmount, setBetAmount] = useState(100);

  const isMyTurn = gameState.players[gameState.turn.player_idx]?.nick === nick;
  const isBettingPhase = gameState.game_phase === GamePhase.BETTING;

  // Logic: Show controls if it's Betting Phase OR if it's My Turn
  const showControls = isBettingPhase || isMyTurn;

  const validMoves = gameState.turn.validMoves.map((m) => Action.toLowerCase(m));

  return (
    <div className="game-controls">
      <div className={`turn-info ${isMyTurn ? "my-turn" : ""}`}>
        <h3>
          {isBettingPhase
            ? "Place your bets!"
            : isMyTurn
              ? "It's your turn!"
              : `Current turn: ${gameState.players[gameState.turn.player_idx]?.nick || "Unknown"}`}
        </h3>
        {timeLeft !== null && (
          <div className={`timer ${timeLeft < 5 ? "timer-urgent" : ""}`}>Time left: {timeLeft}s</div>
        )}
      </div>

      {showControls && (
        <div className="game-controls-buttons">
          {isBettingPhase ? (
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
              {/* Added Logic for missing Insurance button (from previous analysis) */}
              {validMoves.includes("insurance") && (
                <button
                  onClick={() => socket.emit("action", Action.INSURANCE, undefined, true)}
                  className="control-btn btn-insurance"
                >
                  INSURANCE
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
