export enum Action { STAND, DOUBLE, SPLIT, HIT, BET, INSURANCE }

export namespace Action {
    export function toLowerCase(action: Action): string {
        switch (action) {
            case Action.STAND:
                return "stand";
            case Action.DOUBLE:
                return "double";
            case Action.SPLIT:
                return "split";
            case Action.HIT:
                return "hit";
            case Action.BET:
                return "bet";
            case Action.INSURANCE:
                return "insurance";
        }
    }
}

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

export interface ActionRequest {
    allowedMoves: Action[],
    end_timestamp: number;
}

export interface KickMessage {
    reason: string,
    room_id: string;
}

export interface UserInfo {
    balance: number,
}