import { Server } from "socket.io";

import { User } from "./user";
import { Action } from "../shared/types";
import { Game } from "../game/game";
import { logger } from "../shared/logger";


export class Room {
    public id: string;
    public game: Game; // TODO: set to private and add getter
    private io: Server;

    private users: Map<string, User> = new Map();

    private timeout: NodeJS.Timeout | null = null;
    private readonly TIME_LIMIT: number = 15e3; // 15 seconds


    constructor(io: Server) {
        this.id = crypto.randomUUID();
        this.io = io;
        this.game = new Game(); // TODO: remove this from game and room (DONE)
    }

    public handle_join(user: User) {

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

        logger.info(`Broadcasting game state. Moves: ${JSON.stringify(this.game.turn.validMoves)}`);
        user.socket.on("action", (action: Action, amount?: number) => {
            this.handle_action(user, action, amount);
        });

        this.io.to(this.id).emit("game", this.game);
        if (this.users.size == 1) { // check if first player again or reuse var if scope allows
            this.request_action();
        }
    }

    private request_action() {
        this.remove_inactive_users();
        const current_user = this.users.get(this.game.get_current_player_nick());
        if (current_user) {
            const validMoves = this.game.turn.validMoves;
            logger.info(`Waiting for response [${validMoves}] from ${current_user.nick}`);
            current_user.send(
                "your_turn",
                {
                    allowedMoves: validMoves,
                    time_left: this.TIME_LIMIT
                }
            );
        } else {
            logger.error(`Failed to get current user in room ${this.id}`);
            // ?
            return;
        }

        this.timeout = setTimeout(
            () => {
                const current_nick = this.game.get_current_player_nick();
                logger.warn(`User ${current_nick} did not respond, handling timeout`);
                this.handle_timeout(current_user);
            },
            this.TIME_LIMIT
        );

    }

    private handle_action(user: User, action: Action, bet_amount?: number, insurance_decision?: boolean) {

        const current_user = this.users.get(this.game.get_current_player_nick());
        if (current_user) {

            if (user.socket_id !== current_user.socket_id) {
                user.send("error", "It's not your turn");
                return;
            }

            if (action === Action.BET && !bet_amount) {
                user.send("error", "Trying to bet without specifying the amount");
                return;
            }

            if (action === Action.INSURANCE && !insurance_decision) {
                user.send("error", "Trying to insure without specifying the decision");
                return;
            }

            if (!this.game.turn.validMoves.includes(action)) {
                user.send("error", `You can not perform action ${action}`);
                return;
            }

            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }

            logger.info(`Player ${user.nick} performed: ${action} in room ${this.id}`);

            switch (action) {
                case Action.BET:
                    if (bet_amount) {
                        this.game.bet(bet_amount, user.nick);
                    }
                    break;
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
                    if (insurance_decision) {
                        this.game.insurance(insurance_decision);
                    }
                    break;
                default:
                    logger.warn(`Invalid action received`);
                    user.send("error", `Action (${action}) is not supported`);
            }
            this.io.to(this.id).emit("game", this.game); // TODO: to be changed to bare minimum data
            this.request_action();
        } else {
            user.send("error", `Internal error, no user was found for the current player.`);
        }
    }


    private handle_timeout(user: User) {
        this.game.stand();
        this.mark_as_inactive(user);
        this.timeout = null;
    }

    public mark_as_inactive(user: User) {
        user.active = false;
        user.socket.leave(this.id);
        user.socket.removeListener("action", this.handle_action);
        this.game.mark_as_inactive(user.nick);
    }

    public mark_as_active(user: User) {
        user.active = true;
        user.socket.join(this.id);
        this.game.mark_as_active(user.nick); // TODO: to be modified in game.ts
    }

    private remove_inactive_users() {
        for (var nick of this.game.remove_inactive_players()) { // TODO: to be added in game.ts
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