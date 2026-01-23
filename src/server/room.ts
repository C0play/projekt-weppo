import { Server } from "socket.io";

import { User } from "./user";
import { Action } from "../shared/types";
import { Game } from "../game/game";
import { GamePhase } from "../game/types";
import { logger } from "../shared/logger";
import { BetRequest } from "./types";


export class Room {
    public readonly id: string;
    public readonly game: Game; // TODO: set to private and add getter
    private io: Server;

    private users: Map<string, User> = new Map(); // nick -> user

    private timeout: NodeJS.Timeout | null = null;
    private readonly TIME_LIMIT: number = 15e3; // 15 seconds


    constructor(io: Server) {
        this.id = crypto.randomUUID();
        this.game = new Game();
        this.io = io;
    }

    public handle_join(user: User): void {

        user.socket.removeAllListeners("action");

        if (this.users.has(user.nick)) {                                    // reconnecting
            this.mark_as_active(user);
            logger.info(`Player ${user.nick} added to room ${this.id}`);
        } else {                                                            // connecting
            user.room_id = this.id;
            this.users.set(user.nick, user);
            this.game.connect_player(user.nick);

            user.socket.join(this.id);
            logger.info(`Player ${user.nick} added to room ${this.id}`);
        }

        user.socket.on("action", (action: Action, amount?: number) => {
            this.handle_action(user, action, amount);
        });

        this.io.to(this.id).emit("game", this.game);
        if (this.users.size == 1) {
            this.request_action();
        }
    }

    private request_action(): void {

        this.remove_inactive_users();

        // ==================== BETTING ====================
        if (this.game.game_phase === GamePhase.BETTING) {
            logger.info(`Waiting for bets from all users.`);
            for (let user of this.users.values()) {
                const resp: BetRequest = {
                    allowedMoves: [Action.BET],
                    time_left: this.TIME_LIMIT * 2,
                };
                user.send("your_turn", resp);
            }
            this.timeout = setTimeout(
                () => {
                    this.handle_betting_timeout();
                },
                this.TIME_LIMIT * 2
            );
            this.io.to(this.id).emit("game", this.game);
            return;
        }

        // ==================== PLAYING ====================
        const current_user = this.users.get(this.game.get_current_player_nick());
        if (current_user) {
            const validMoves = this.game.turn.validMoves;
            logger.info(`Waiting for response [${validMoves.keys()}] from ${current_user.nick}`);
            const resp: BetRequest = {
                allowedMoves: validMoves,
                time_left: this.TIME_LIMIT,
            };
            this.io.to(this.id).emit("game", this.game);
            current_user.send("your_turn", resp);
        } else {
            logger.error(`Failed to get current user in room ${this.id}`);
            // ?
            return;
        }

        this.timeout = setTimeout(
            () => {
                const current_nick = this.game.get_current_player_nick();
                logger.warn(`User ${current_nick} did not respond, handling timeout`);
                this.handle_playing_timeout(current_user);
            },
            this.TIME_LIMIT
        );

    }

    private handle_action(
        user: User,
        action: Action,
        bet_amount?: number,
        insurance_decision?: boolean): void {

        // =================================== BETTING ===================================
        if (this.game.game_phase === GamePhase.BETTING && action === Action.BET) {
            if (bet_amount === undefined) {
                user.send("error", "Trying to bet without specifying the amount");
                return;
            }
            if (!this.game.bet(bet_amount, user.nick)) {
                user.send("error", `Trying to bet ${bet_amount} failed due to insufficient funds.`);
                return;
            }
            logger.info(`Player ${user.nick} bet ${bet_amount} in room ${this.id}`);

            // =================================== PLAYING ===================================
        } else {
            const current_user = this.users.get(this.game.get_current_player_nick());
            if (!current_user) {
                user.send("error", `Internal server error, no user was found for the current player.`);
                return;
            }

            if (user.socket_id !== current_user.socket_id) {
                user.send("error", "It's not your turn");
                return;
            }

            if (!this.game.turn.validMoves.includes(action)) {
                user.send("error", `You can not perform this action: ${action}`);
                return;
            }

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
                        user.send("error", "Trying to insure without specifying a decision");
                        return;
                    }
                    this.game.insurance(insurance_decision);
                    break;
                default:
                    logger.warn(`Invalid action received: ${action}`);
                    user.send("error", `Action (${action}) is can not be performed`);
                    return;
            }

            logger.info(`Player ${user.nick} performed: ${action} in room ${this.id}`);
            if (this.timeout) {
                logger.debug(`Clearing timeout ${this.timeout}`)
                clearTimeout(this.timeout);
                this.timeout = null;
            }
            this.request_action();
        }
        this.io.to(this.id).emit("game", this.game); // TODO: to be changed to bare minimum data
    }


    private handle_playing_timeout(user: User): void {
        this.game.stand();
        this.mark_as_inactive(user);
        this.request_action();

        this.timeout = null;
    }

    private handle_betting_timeout(): void {

        for (let nick of this.game.get_players_with_no_bet()) {
            const user = this.users.get(nick);
            if (!user) {
                logger.error(
                    `User ${nick} does not exist, but a player does in the game engine.`);
                continue;
            }
            this.mark_as_inactive(user);
        }

        this.remove_inactive_users();
        this.game.change_game_phase();
        this.request_action();

        this.timeout = null;
    }

    public mark_as_inactive(user: User): void {
        user.active = false;
        user.socket.leave(this.id);
        user.socket.removeListener("action", this.handle_action);
        this.game.mark_as_inactive(user.nick);
    }

    private mark_as_active(user: User): void {
        user.active = true;
        user.socket.join(this.id);
        this.game.mark_as_active(user.nick);
    }

    private remove_inactive_users(): void {
        if (this.game.game_phase === GamePhase.PLAYING) {
            return;
        }

        for (let nick of this.game.remove_inactive_players()) {
            const user = this.users.get(nick);
            if (user) {
                user.active = false;
                user.room_id = null;
                user.socket.leave(this.id);
            }
            this.users.delete(nick);
            logger.info(`Removed inactive user ${nick} from room ${this.id}`);
        }
    }

    public destroy() {
        if (this.timeout) clearTimeout(this.timeout);
    }

}