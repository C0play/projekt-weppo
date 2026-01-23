import { Server } from "socket.io";

import { User } from "./user";
import { Action } from "../shared/types";
import { Game } from "../game/game";
import { GamePhase } from "../game/types";
import { logger } from "../shared/logger";
import { BetRequest, KickMessage } from "./types";


export class Room {
    public readonly id: string;
    public readonly game: Game; // TODO: set to private and add getter
    private readonly io: Server;

    private readonly TIME_LIMIT: number = 10e3; // miliseconds
    private on_empty?: (id: string) => void;

    private users: Map<string, User> = new Map(); // nick -> user
    private timeout: NodeJS.Timeout | null = null;



    constructor(io: Server, on_empty?: (id: string) => void) {
        this.id = crypto.randomUUID();
        this.game = new Game();
        this.io = io;
        this.on_empty = on_empty;
    }

    public connect(user: User): void {

        user.socket.removeAllListeners("action");

        if (this.users.has(user.nick)) {                                    // reconnecting
            logger.info(`Player ${user.nick} re-connected to room ${this.id}`);
            this.mark_as_active(user);
        } else {                                                            // connecting
            user.room_id = this.id;
            this.users.set(user.nick, user);
            this.game.connect_player(user.nick);

            user.socket.join(this.id);
            logger.info(`Player ${user.nick} joined room ${this.id} for the first time`);
        }

        user.socket.on("action", (action: Action, amount?: number) => {
            this.handle_action(user, action, amount);
        });

        this.emit_game_state();

        if (this.users.size == 1) { this.request_action(); }
    }

    private request_action(): void {

        this.remove_inactive_users();
        if (this.users.size === 0) {
            logger.debug(`Room ${this.id} is empty, stopping game loop.`);
            return;
        }
        logger.debug(`Requesting action in room ${this.id}. Current phase: ${this.game.game_phase}`);

        // ==================== BETTING ====================
        if (this.game.game_phase === GamePhase.BETTING) {
            logger.info(`Phase: BETTING. Waiting for bets from ${this.users.size} users.`);
            for (let user of this.users.values()) {
                const resp: BetRequest = {
                    allowedMoves: [Action.BET],
                    time_left: Date.now() + this.TIME_LIMIT * 2,
                };
                user.send("your_turn", resp);
                logger.debug(`Sent bet request to ${user.nick}`);
            }

            logger.debug(`Setting betting timeout for ${this.TIME_LIMIT * 2}ms`);
            this.timeout = setTimeout(
                () => {
                    this.handle_betting_timeout();
                },
                this.TIME_LIMIT * 2
            );
            this.emit_game_state();

            // ==================== PLAYING ====================
        } else {
            const current_player_nick = this.game.get_current_player_nick();
            const current_user = this.users.get(current_player_nick);
            if (current_user) {
                const validMoves = this.game.turn.validMoves;
                let validNames = validMoves.map((move) => Action.toLowerCase(move));

                logger.info(`Phase: PLAYING. Waiting for ${validNames} from ${current_user.nick} (current_player_idx: ${this.game.turn.player_idx})`);

                const req: BetRequest = {
                    allowedMoves: validMoves,
                    time_left: Date.now() + this.TIME_LIMIT,
                };
                current_user.send("your_turn", req);

                this.emit_game_state();

                this.timeout = setTimeout(
                    () => {
                        logger.warn(`User ${current_user.nick} did not respond within ${this.TIME_LIMIT}ms, triggering playing timeout`);
                        this.handle_playing_timeout(current_user);
                    },
                    this.TIME_LIMIT
                );
                logger.debug(`Set playing timeout (id: ${this.timeout}) for ${current_user.nick}`);

            } else {
                logger.error(`Critical Error: Nick '${current_player_nick}' is the current player in Game engine, but no User object exists in Room ${this.id}`);
            }
        }
    }

    private handle_action(
        user: User,
        action: Action,
        bet_amount?: number,
        insurance_decision?: boolean): void {

        // =================================== BETTING ===================================
        if (this.game.game_phase === GamePhase.BETTING && action === Action.BET) {
            if (bet_amount === undefined) {
                logger.warn(`Player ${user.nick} tried to bet without amount`);
                user.send("error", "Trying to bet without specifying the amount");
                return;
            }

            logger.info(`Current bet for ${user.nick} is ${this.game.get_player_bet(user.nick)}`);
            if (this.game.get_player_bet(user.nick) !== 0) {
                logger.warn(`Player ${user.nick} tried betting multile times (already bet ${this.game.get_player_bet(user.nick)})`);
                user.send("error", `Trying to bet multiple times.`);
                return;
            }

            if (!this.game.bet(bet_amount, user.nick)) {
                logger.warn(`Player ${user.nick} bet ${bet_amount} failed (insufficient balance)`);
                user.send("error", `Trying to bet ${bet_amount} failed due to insufficient funds.`);
                return;
            }

            logger.info(`Player ${user.nick} bet ${bet_amount} in room ${this.id}`);

            if (this.game.get_players_with_no_bet().length === 0) {
                this.handle_betting_timeout();
            }

            // =================================== PLAYING ===================================
        } else if (this.game.game_phase === GamePhase.PLAYING) {

            const current_user = this.users.get(this.game.get_current_player_nick());
            if (!current_user) {
                logger.error(`Logic error: No user object found for current player nick: ${this.game.get_current_player_nick()}`);
                user.send("error", `Internal server error, no user was found for the current player.`);
                return;
            }

            if (user.socket_id !== current_user.socket_id) {
                logger.warn(`Player ${user.nick} tried to act out of turn (it's ${current_user.nick}'s turn)`);
                user.send("error", "It's not your turn");
                return;
            }

            if (!this.game.turn.validMoves.includes(action)) {
                logger.warn(`Player ${user.nick} tried invalid action: ${Action.toLowerCase(action)} (valid: [${this.game.turn.validMoves.map(m => Action.toLowerCase(m))}])`);
                user.send("error", `You can not perform this action: ${action}`);
                return;
            }

            logger.info(`Processing action [${Action.toLowerCase(action)}] for player ${user.nick}`);
            switch (action) {
                case Action.DOUBLE:
                    this.game.double();
                    break;
                case Action.HIT:
                    this.game.hit();
                    break;
                case Action.SPLIT:
                    this.game.split();
                    break;
                case Action.STAND:
                    this.game.stand();
                    break;
                case Action.INSURANCE:
                    if (insurance_decision === undefined) {
                        logger.warn(`Player ${user.nick} tried INSURANCE but decision was undefined`);
                        user.send("error", "Trying to insure without specifying a decision");
                        return;
                    }
                    this.game.insurance(insurance_decision);
                    break;
                default:
                    logger.error(`Logic Error: Action ${action} reached switch but is not explicitly handled`);
                    user.send("error", `Action (${action}) can not be performed`);
                    return;
            }

            logger.info(`Successfully completed action ${Action.toLowerCase(action)} for ${user.nick}`);

            if (this.timeout !== null) {
                logger.debug(`Clearing timeout ${this.timeout} for ${user.nick} after successful action`);
                clearTimeout(this.timeout);
                this.timeout = null;
            } else {
                logger.error(`Timeout for ${this.timeout}`);
            }

            this.request_action();
        }
        this.emit_game_state(); // TODO: to be changed to bare minimum data
    }


    private handle_playing_timeout(user: User): void {
        logger.debug(`Timeout ${this.timeout} expired for user ${user.nick}`);
        this.timeout = null;

        this.game.stand();
        this.mark_as_inactive(user, "timed out");
        this.request_action();
    }

    private handle_betting_timeout(): void {
        if (this.timeout !== null) {
            logger.debug(`All players made bets, clearing betting timeout`);
            clearTimeout(this.timeout);
        } else {
            logger.debug(`Beting timeout expired, proceeding to playing.`);
        }
        this.timeout = null;

        for (let nick of this.game.get_players_with_no_bet()) {
            const user = this.users.get(nick);
            if (!user) {
                logger.error(
                    `User ${nick} does not exist, but a player does in the game engine.`);
                continue;
            }
            this.mark_as_inactive(user, "timed out");
        }

        this.remove_inactive_users();
        this.game.change_game_phase();
        this.request_action();
    }

    public mark_as_inactive(user: User, reason: string): void {
        logger.info(`Marking player ${user.nick} as inactive in room ${this.id}. Reason: ${reason}`);
        user.active = false;
        user.socket.leave(this.id);
        user.socket.removeListener("action", this.handle_action);
        const msg: KickMessage = {
            reason: reason,
            room_id: this.id,
        };
        user.send("kick", msg);
        this.game.mark_as_inactive(user.nick);
    }

    private mark_as_active(user: User): void {
        logger.info(`Marking player ${user.nick} as active in room ${this.id}`);
        user.active = true;
        user.socket.join(this.id);
        this.game.mark_as_active(user.nick);
    }

    private remove_inactive_users(): void {
        if (this.game.game_phase === GamePhase.PLAYING) {
            logger.debug(`Skipping removal of inactive users during PLAYING phase in room ${this.id}`);
            return;
        }

        for (let nick of this.game.remove_inactive_players()) {
            const user = this.users.get(nick);
            if (user) {
                user.active = false;
                user.room_id = null;
                user.socket.leave(this.id);

                const msg: KickMessage = {
                    reason: "removed",
                    room_id: this.id,
                };
                user.send("kick", msg);
                
                logger.info(`Notified and removed user ${nick} from room ${this.id}`);
            } else {
                logger.warn(`Player ${nick} removed from game engine, but no user object found in room ${this.id}`);
            }
            this.users.delete(nick);
            logger.info(`Cleaned up user ${nick} from room ${this.id} users map`);
        }

        if (this.users.size === 0 && this.on_empty) {
            logger.info(`Room ${this.id} is empty, triggering removal`);
            this.on_empty(this.id);
            this.on_empty = undefined;
            this.destroy();
        }
    }

    private emit_game_state(): void {
        this.io.to(this.id).emit("game", this.game);
    }

    public destroy() {
        if (this.timeout) clearTimeout(this.timeout);
    }
}