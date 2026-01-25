import { Action } from "../shared/types";

export interface Card {
  rank: string;
  suit: string;
  point: number;
}

export type HandResult = "WIN" | "LOSE" | "PUSH" | "BLACKJACK" | "BUST";

export interface Hand {
    bet: number;
    cards: Card[];
    points: number;
    is_insured: boolean;
    number_of_full_aces: number;
    result?: HandResult;
}

export interface Dealer {
  cards: Card[];
  points: number;
  number_of_full_aces: number;
}

export interface Turn {
  player_idx: number;
  hand_idx: number;
  timestamp: number;
  validMoves: Action[];
}
export enum PlayerState {
  "ACTIVE",
  "INACTIVE",
  "SPECTATING",
}
export interface Player {
  nick: string;
  hands: Hand[];
  balance: number;
  player_idx: number;
  player_state: PlayerState;
}
export enum GamePhase {
  "BETTING",
  "PLAYING",
  "RESULTS",
}
export interface GameState {
  number_of_players: number;
  max_players: number;
  turn: Turn;
  players: Player[];
  dealer: Dealer;
  game_phase: GamePhase;
}
