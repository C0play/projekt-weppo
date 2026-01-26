
import { Socket } from "socket.io";
import { ActionRequest, KickMessage } from "../shared/types";
import { logger } from "@shared/logger";

export class User {
    public socket: Socket;
    public socket_id: string;
    public token: string = "";
    public nick: string;

    public room_id: string | null = null;
    public active: boolean = true;

    constructor(socket: Socket, nick: string) {
        this.socket = socket;
        this.socket_id = socket.id;
        this.nick = nick;
    }

    public send_kick_message(data: KickMessage) {
        this.send("kick", data);
        logger.debug(`Sent kick message`, { nick: this.nick, roomId: this.room_id || 'NONE' });
    }

    public send_action_request(data: ActionRequest) {
        this.send("your_turn", data);
        logger.debug(`Sent bet request`, { nick: this.nick, roomId: this.room_id || 'NONE' });
    }

    public send(event: string, data: any): void {
        this.socket.emit(event, data);
    }
}