
import { Socket } from "socket.io";

export class User {
    public socket: Socket;
    public socket_id: string;
    public token: string;
    public nick: string;

    public room_id: string | null = null;
    public active: boolean = true;

    constructor(socket: Socket, nick: string) {
        this.socket = socket;
        this.socket_id = socket.id;
        this.token = socket.id;
        this.nick = nick;
    }

    send(event: string, data: any) {
        this.socket.emit(event, data);
    }
}