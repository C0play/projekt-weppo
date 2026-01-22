
export enum Action {STAND, DOUBLE, SPLIT, HIT, BET, INSURANCE }

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