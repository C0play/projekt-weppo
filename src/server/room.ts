import { Server } from "socket.io";

import { User } from "./user";
import { Game } from "../game/game";
import { GamePhase } from "../game/types";
import { logger } from "../shared/logger";
import { Action } from "../shared/types";


export class Room {
    public readonly id: string;

    private readonly game: Game;
    private readonly io: Server;
    private readonly logger: any;
    private on_empty?: (id: string) => void;

    private readonly TURN_TIME_LIMIT: number = 10e3;    // miliseconds
    private readonly BET_TIME_LIMIT: number = 20e3;     // miliseconds
    private readonly DEALER_CARD_DELAY: number = 0.5e3; // miliseconds per card reveal
    private readonly RESULT_DISPLAY_TIME: number = 5e3; // miliseconds to display final results

    private users: Map<string, User> = new Map(); // nick -> user
    private timeout: NodeJS.Timeout | null = null;
    private timeout_end: number | null = null;


    constructor(io: Server, on_empty?: (id: string) => void) {
        this.id = crypto.randomUUID();
        this.game = new Game();
        this.io = io;
        this.on_empty = on_empty;
        this.logger = logger.child({ roomId: this.id });
    }


    public connect(user: User): void {

        user.socket.removeAllListeners("action");

        const existingUser = this.users.get(user.nick);

        // reconnecting (session preserved)
        if (existingUser) {
            this.logger.info(`Player re-connected to room (session preserved)`, { nick: user.nick });

            if (existingUser !== user) {
                this.users.set(user.nick, user);
            }
            this.mark_as_active(user);
        }
        // reconnecting (restoring from game state)
        else if (this.game.has_player(user.nick)) {
            this.logger.info(`Player re-connected to room (restored from game state)`, { nick: user.nick });
            user.room_id = this.id;
            this.users.set(user.nick, user);
            this.mark_as_active(user);
        }
        // connecting (new)
        else {
            user.room_id = this.id;
            this.users.set(user.nick, user);
            if (!this.game.connect_player(user.nick, user.balance)) {
                this.logger.warn(`Failed to connect player to game engine (full?)`, { nick: user.nick });
                user.send("error", "Room is full or game error.");
                this.users.delete(user.nick);
                user.room_id = null;
                return;
            }
            user.socket.join(this.id);
            this.logger.info(`Player joined room for the first time`, { nick: user.nick });
        }

        user.socket.on("action", (action: Action, amount?: number, insurance_decision?: boolean) => {
            this.handle_action(user, action, amount, insurance_decision);
        });

        this.emit_game_state();

        if (!this.timeout) {
            this.request_action();
            return;
        }

        if (this.game.game_phase === GamePhase.BETTING && this.timeout_end) {
            user.send_action_request({
                allowedMoves: [Action.BET],
                end_timestamp: this.timeout_end,
            });

        } else if (this.game.game_phase === GamePhase.PLAYING && this.timeout_end) {
            if (user.nick !== this.game.get_current_player_nick()) {
                return;
            }
            user.send_action_request({
                allowedMoves: this.game.turn.validMoves,
                end_timestamp: this.timeout_end,
            });
        }
    }


    private request_action(): void {

        this.remove_inactive_users();
        if (this.users.size === 0) {
            this.logger.debug(`Room is empty, stopping game loop.`);
            return;
        }

        this.logger.debug(`Requesting action. Current phase: ${this.game.game_phase}`);

        switch (this.game.game_phase) {
            case GamePhase.BETTING:
                this.request_betting();
                break;
            case GamePhase.PLAYING:
                this.request_playing();
                break;
            case GamePhase.RESULTS:
                this.request_results();
                break;
            default:
                this.logger.error(`Unsupported game phase ${this.game.game_phase}`);
        }
    }


    private handle_action(
        user: User,
        action: Action,
        bet_amount?: number,
        insurance_decision?: boolean
    ): void {

        switch (this.game.game_phase) {
            case GamePhase.BETTING:
                this.handle_betting(user, action, bet_amount);
                break;
            case GamePhase.PLAYING:
                this.handle_playing(user, action, insurance_decision);
                break;
            default:
                this.logger.error(`Unsupported game phase ${this.game.game_phase}`);
                break;
        }

        this.emit_game_state();
    }

    // =================================== BETTING ===================================

    private request_betting(): void {
        this.logger.info(`Phase: BETTING. Waiting for bets from ${this.users.size} users.`);

        this.set_timeout(
            this.BET_TIME_LIMIT,
            () => { this.handle_betting_timeout(); }
        );

        for (let user of this.users.values()) {
            if (this.timeout_end === null) {
                this.logger.error(`Timer was not set before sending Action requests`);
                return;
            }
            user.send_action_request({
                allowedMoves: [Action.BET],
                end_timestamp: this.timeout_end,
            });
        }

        this.logger.debug(`Setting betting timeout for ${this.TURN_TIME_LIMIT * 2}ms`);
        this.emit_game_state();
    }


    private handle_betting(user: User, action: Action, bet_amount?: number): void {
        if (action !== Action.BET) {
            this.logger.debug(`Ignoring action ${action} during BETTING`, { nick: user.nick });
            return;
        }

        if (bet_amount === undefined) {
            this.logger.warn(`Player tried to bet without amount`, { nick: user.nick });
            user.send("error", "Trying to bet without specifying the amount");
            return;
        }

        if (this.game.get_player_bet(user.nick) !== 0) {
            this.logger.warn(`Player tried betting multile times (already bet ${this.game.get_player_bet(user.nick)})`, { nick: user.nick });
            user.send("error", `Trying to bet multiple times.`);
            return;
        }

        if (!this.game.bet(bet_amount, user.nick)) {
            this.logger.warn(`Player bet ${bet_amount} failed (insufficient balance)`, { nick: user.nick });
            user.send("error", `Trying to bet ${bet_amount} failed due to insufficient funds.`);
            return;
        }

        this.logger.info(`Player bet ${bet_amount}`, { nick: user.nick });

        if (this.game.get_players_with_no_bet().length === 0) {
            this.handle_betting_timeout();
        }
    }


    private handle_betting_timeout(): void {

        this.clear_timeout();

        for (let nick of this.game.get_players_with_no_bet()) {
            const user = this.users.get(nick);
            if (!user) {
                this.logger.error(`User does not exist, but a player does in the game engine.`, { nick: nick });
                continue;
            }
            this.mark_as_inactive(user, "did not place a bet");
        }

        this.remove_inactive_users();
        this.game.change_game_phase();
        this.request_action();
    }

    // =================================== PLAYING ===================================

    private request_playing(): void {
        const current_player_nick = this.game.get_current_player_nick();
        const current_user = this.users.get(current_player_nick);
        if (current_user) {

            const validMoves = this.game.turn.validMoves;
            let validNames = validMoves.map((move) => Action.toLowerCase(move));

            this.logger.info(`Phase: PLAYING. Waiting for [${validNames}]`, { nick: current_user.nick });

            this.set_timeout(
                this.TURN_TIME_LIMIT,
                () => {
                    this.logger.warn(`User did not respond within ${this.TURN_TIME_LIMIT}ms, triggering playing timeout`, { nick: current_user.nick });
                    this.handle_playing_timeout(current_user);
                }
            );
            this.logger.debug(`Set playing timeout (id: ${this.timeout}) for player`, { nick: current_user.nick });

            current_user.send_action_request({
                allowedMoves: validMoves,
                end_timestamp: this.timeout_end ? this.timeout_end : Date.now() + this.TURN_TIME_LIMIT,
            });
            this.emit_game_state();


        } else {
            this.logger.error(`Critical Error: Current player in Game engine has no User object`, { nick: current_player_nick });
        }
    }


    private handle_playing(
        user: User,
        action: Action,
        insurance_decision?: boolean
    ): void {
        const current_player_nick = this.game.get_current_player_nick();
        const current_user = this.users.get(current_player_nick);
        if (!current_user) {
            this.logger.error(`Logic error: No user object found for current player nick`, { nick: current_player_nick });
            user.send("error", `Internal server error, no user was found for the current player.`);
            return;
        }

        if (user.socket_id !== current_user.socket_id) {
            this.logger.warn(`Player tried to act out of turn (it's someone else's turn)`, { nick: user.nick });
            user.send("error", "It's not your turn");
            return;
        }

        if (!this.game.turn.validMoves.includes(action)) {
            this.logger.warn(`Player tried invalid action: ${Action.toLowerCase(action)} (valid: [${this.game.turn.validMoves.map(m => Action.toLowerCase(m))}])`, { nick: user.nick });
            user.send("error", `You can not perform this action: ${action}`);
            return;
        }

        this.logger.info(`Processing action [${Action.toLowerCase(action)}]`, { nick: user.nick });
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
                    this.logger.warn(`Player tried INSURANCE but decision was undefined`, { nick: user.nick });
                    user.send("error", "Trying to insure without specifying a decision");
                    return;
                }
                this.game.insurance(insurance_decision);
                break;
            default:
                this.logger.error(`Logic Error: Action ${action} reached switch but is not explicitly handled`);
                user.send("error", `Action (${action}) can not be performed`);
                return;
        }

        this.logger.info(`Successfully completed action ${Action.toLowerCase(action)}`, { nick: user.nick });

        this.clear_timeout();
        this.request_action();
    }


    private handle_playing_timeout(user: User): void {
        this.logger.debug(`Timeout ${this.timeout} expired`, { nick: user.nick });
        this.timeout = null;

        this.game.stand();
        this.request_action();
    }

    // =================================== RESULTS ===================================

    private request_results() {
        // Calculate time: 0.5s per dealer card revealed (minus the initial card) + 5s for results
        const dealerCards = this.game.dealer.cards.length;
        const revealTime = (dealerCards - 1) * this.DEALER_CARD_DELAY;
        const totalTime = revealTime + this.RESULT_DISPLAY_TIME;
        
        this.logger.info(`Phase: RESULTS. Dealer has ${dealerCards} cards. Displaying results for ${totalTime}ms (${revealTime}ms reveal + ${this.RESULT_DISPLAY_TIME}ms display)`);

        this.set_timeout(
            totalTime,
            () => {
                this.clear_timeout();
                this.game.change_game_phase();
                this.request_action();
            }
        );

        this.emit_game_state();
    }

    // =================================== HELPERS ===================================

    public mark_as_inactive(user: User, reason: string): void {
        this.logger.info(`Marking player as inactive. Reason: ${reason}`, { nick: user.nick });
        user.active = false;
        if (reason === "left") {
            user.socket.leave(this.id);
        }
        user.socket.removeListener("action", this.handle_action);
        this.game.mark_as_inactive(user.nick);
    }


    private mark_as_active(user: User): void {
        this.logger.info(`Marking player as active`, { nick: user.nick });
        user.active = true;
        user.socket.join(this.id);
        this.game.mark_as_active(user.nick);
    }


    public leave(user: User): void {
        this.logger.info(`Player requested to leave room`, { nick: user.nick });

        this.mark_as_inactive(user, "left");

        if (this.game.has_player(user.nick)) {
            user.balance = this.game.get_player_balance(user.nick);
        }

        this.users.delete(user.nick);
        user.room_id = null;
        this.remove_inactive_users();
    }


    private remove_inactive_users(): void {
        if (this.game.game_phase === GamePhase.PLAYING) {
            this.logger.debug(`Skipping removal of inactive users during PLAYING phase`);
            return;
        }

        const inactive_players = this.game.remove_inactive_players();
        if (inactive_players.length > 0) {
            const nicks = inactive_players.map(p => p.nick);
            this.logger.debug(`Removing inactive players: [${nicks}]`);
        } else {
            this.logger.debug(`No players to remove`);
        }

        for (let { nick, balance } of inactive_players) {
            const user = this.users.get(nick);
            if (user) {
                user.balance = balance;

                if (user.room_id === this.id) {
                    user.send_kick_message({
                        reason: "removed",
                        room_id: this.id,
                    });
                    user.room_id = null;
                }

                user.active = false;
                user.socket.leave(this.id);


                this.logger.info(`Notified and removed player from room`, { nick: nick });
            } else {
                this.logger.debug(`Player removed from game engine, but user object already gone from room (manual leave?)`, { nick: nick });
            }
            this.users.delete(nick);
            this.logger.info(`Cleaned up player from room users map`, { nick: nick });
        }

        if (this.users.size === 0 && this.on_empty) {
            this.logger.info(`Room is empty, triggering removal`);
            this.on_empty(this.id);
            this.on_empty = undefined;
            this.destroy();
        }
    }


    private set_timeout(time: number, handler: () => void) {
        if (this.timeout !== null) {
            this.logger.error(`Tried to set timer, while it's not null (id: ${this.timeout})`);
            return;
        }
        this.timeout_end = Date.now() + time + 1e3;
        this.timeout = setTimeout(
            handler,
            time + 1e3
        );
    }


    private clear_timeout() {
        this.timeout_end = null;
        if (this.timeout !== null) {
            this.logger.debug(`Clearing timer ${this.timeout}`);
            clearTimeout(this.timeout);
        } else {
            this.logger.error(`Tried to clear timer, while it's null`);
        }
        this.timeout = null;
    }


    private emit_game_state(): void {
        this.io.to(this.id).emit("game", this.game);
    }


    public destroy() {
        if (this.timeout) clearTimeout(this.timeout);
    }
}