import { Action } from "../shared/types";

export interface LoginRequest {
    nick: string;
    token: string | null;
}

export interface LoginResponse {
    success: boolean,
    msg: string;

    nick?: string,
    token?: string,
    restored?: boolean;
}

export interface RoomRequest {
    id: string;
}

export interface RoomsResponse {
    id: string[];
}

export interface BetRequest {
    allowedMoves: Action[],
    time_left: number;
}

