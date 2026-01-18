export interface Card {
    rank: string;
    suit: string;
    point: number;
}

export interface Hand {
    bet: number;
    cards: Card[];
    points: number;
    number_of_full_aces : number;
}

export interface Dealer {
    cards: Card[];
    points: number;
    number_of_full_aces : number;
}

export interface Turn {
    player_idx: number;
    hand_idx: number;
    timestamp: number;
    validMoves : string[];
}

export interface Player {
    nick: string;
    hands: Hand[];
    balance: number;
    player_idx: number;
    active : boolean
}

export interface GameState {
    uuid: string;
    number_of_players: number;
    max_players: number;
    turn: Turn;
    players: Player[];
    dealer: Dealer;
}
