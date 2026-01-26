import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";

import { Room } from "./room";
import { User } from "./user";
import {
  LoginRequest, LoginResponse,
  RoomRequest, RoomsResponse
} from "../shared/types";
import { logger } from "../shared/logger";
import { Config } from "../shared/config";


// -- Wrappers for sending packets --

function send_error(socket: Socket, message: string) {
  socket.emit("error", message);
}

function send_login_response(socket: Socket, response: LoginResponse) {
  socket.emit("login_response", response);
}

function send_game_ids(socket: Socket, response: RoomsResponse) {
  socket.emit("game_ids", response);
}


// -- Main Server Class --

class GameServer {
  private app: express.Express;
  private server: any; // Return type of createServer
  private io: Server;

  private sockets: Map<string, string> = new Map(); // socket_id -> nick
  private users: Map<string, User> = new Map();     // nick -> User
  private rooms: Map<string, Room> = new Map();     // room_id -> Room

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.setup_routes();
  }

  public start() {
    this.server.listen(Config.SERVER_PORT, Config.SERVER_IP, () => {
      logger.info(`Server running at ${JSON.stringify(this.server.address())}`);
    });
  }


  private setup_routes() {
    this.io.on("connection", (socket: Socket) => {
      logger.info(`Connection established with socket ${socket.id}`);

      socket.on("login", (data: LoginRequest) => this.handle_login(socket, data));
      socket.on("disconnect", (reason) => this.handle_disconnect(socket, reason));
      socket.on("get_games", () => this.handle_get_games(socket));
      socket.on("create_game", () => this.handle_create_game(socket));
      socket.on("join_game", (data: RoomRequest) => this.handle_join_game(socket, data));
      socket.on("leave_game", () => this.handle_leave_game(socket));
    });
  }

  // =================================== HANDLERS ===================================

  private handle_login(socket: Socket, data: LoginRequest) {
    const existingUser = this.users.get(data.nick);

    if (!existingUser) {
      const newUser = new User(socket, data.nick);
      newUser.token = data.token || randomUUID();
      this.users.set(data.nick, newUser);
      this.sockets.set(socket.id, data.nick);

      logger.info(`New user registered (token: ${newUser.token})`, { nick: data.nick });

      send_login_response(socket, {
        success: true,
        msg: "User registered successfully.",
        nick: data.nick,
        token: newUser.token,
        restored: false
      });
      return;
    }

    if (data.token === null) {
      send_login_response(socket, {
        success: false,
        msg: "Nick is already taken by another player."
      });
      return;
    }

    if (existingUser.token !== data.token) {
      logger.warn(`Failed login attempt (token mismatch)`, { nick: data.nick });
      send_login_response(socket, {
        success: false,
        msg: "Token mismatch.",
      });
      return;
    }

    if (existingUser.socket.id === socket.id) {
      return;
    }

    logger.info(`Restoring session`, { nick: data.nick });

    existingUser.socket = socket;
    existingUser.socket_id = socket.id;
    this.sockets.set(socket.id, data.nick);

    if (existingUser.room_id) {
      const room = this.rooms.get(existingUser.room_id);
      if (room) {
        logger.info(`Rejoining player to room`, { nick: data.nick, roomId: existingUser.room_id });
        room.connect(existingUser);
      } else {
        logger.warn(`User had room_id but room does not exist anymore`, { nick: data.nick, roomId: existingUser.room_id });
        existingUser.room_id = null;
      }
    }

    send_login_response(socket, {
      success: true,
      nick: existingUser.nick,
      token: existingUser.token,
      restored: true,
      msg: "User restored successfully",
    });
  }


  private handle_disconnect(socket: Socket, reason: string) {
    const nick = this.sockets.get(socket.id);
    if (!nick) {
      logger.info(`Socket disconnected without being registered. Reason: ${reason} (${socket.id})`);
      return;
    }

    const user = this.users.get(nick);
    if (!user) {
      this.sockets.delete(socket.id);
      logger.warn(`User nick found but no user object exists`, { nick: nick });
      return;
    }

    const room_id = user.room_id;
    if (!room_id) {
      logger.info(`Client disconnected, reason: ${reason}`, { nick: nick });
      return;
    }

    const room = this.rooms.get(room_id);
    if (!room) {
      logger.error("User's room does not exist", { nick: nick, roomId: room_id });
      send_error(socket, "User's room does not exist");
      return;
    }

    room.mark_as_inactive(user, "disconnected");
    logger.info(`Client marked for removal, reason: ${reason}`, { nick: nick, roomId: room_id });
  }


  private handle_get_games(socket: Socket) {
    logger.debug(`Socket requested room list. Total rooms: ${this.rooms.size}`, { roomId: 'GLOBAL' });
    const ids: string[] = [];
    for (const room of this.rooms.values()) {
      ids.push(room.id);
    }
    send_game_ids(socket, { id: ids });
  }


  private handle_create_game(socket: Socket) {
    const nick = this.sockets.get(socket.id);
    if (!nick) {
      send_error(socket, `You are not registered (${socket.id})`);
      return;
    }

    const user = this.users.get(nick);
    if (!user) {
      logger.error(`Create failed: User nick found but no User object`, { nick: nick });
      this.sockets.delete(socket.id);
      send_error(socket, `Internal error, please log in again`);
      return;
    }

    const new_room: Room = new Room(this.io, (id) => {
      this.rooms.delete(id);
      logger.info(`Room deleted`, { roomId: id });
    });
    logger.info(`New room created`, { nick: nick, roomId: new_room.id });

    this.rooms.set(new_room.id, new_room);
    new_room.connect(user);

    logger.info(`Total active rooms now: ${this.rooms.size}`);
  }


  private handle_join_game(socket: Socket, room_info: RoomRequest) {
    const nick = this.sockets.get(socket.id);
    if (!nick) {
      logger.warn(`Join failed: Socket not registered`, { roomId: room_info.id });
      send_error(socket, `You are not registered (${socket.id})`);
      return;
    }

    const user = this.users.get(nick);
    if (!user) {
      logger.error(`Join failed: User object missing`, { nick: nick });
      this.sockets.delete(socket.id);
      send_error(socket, `Internal error, please log in again`);
      return;
    }

    if (user.room_id !== null && user.room_id !== room_info.id) {
      user.send("error", `You are already in a room ${user.room_id}`);
      return;
    }

    const room = this.rooms.get(room_info.id);
    if (!room) {
      logger.warn(`Join failed: Room not found`, { nick: nick, roomId: room_info.id });
      send_error(socket, `Requested game does not exist`);
      return;
    }

    logger.info(`Player joining room`, { nick: nick, roomId: room_info.id });
    room.connect(user);
  }


  private handle_leave_game(socket: Socket) {
    const nick = this.sockets.get(socket.id);
    let user = nick ? this.users.get(nick) : null;
    let roomId = user?.room_id || 'UNKNOWN';

    logger.debug(`Socket requested to leave`, { nick: nick || 'UNKNOWN', roomId });

    if (!nick) {
      logger.warn(`Leave failed: Socket not registered`);
      send_error(socket, `You are not registered (${socket.id})`);
      return;
    }

    if (!user) {
      logger.error(`Leave failed: User object missing`, { nick: nick });
      this.sockets.delete(socket.id);
      send_error(socket, `Internal error, please log in again`);
      return;
    }

    const room_id = user.room_id;
    if (room_id === null) {
      logger.warn(`Leave failed: User is not in any room`, { nick: nick });
      send_error(socket, `Can not leave game, because it's null`);
      return;
    }

    const room = this.rooms.get(room_id);
    if (!room) {
      logger.warn(`Leave failed: Room not found`, { nick: nick, roomId: room_id });
      send_error(socket, `Requested game does not exist`);
      return;
    }

    room.leave(user);
  }
}

// Entrypoint

new GameServer().start();

