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



const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const sockets: Map<string, string> = new Map(); // socket_id -> nick
const users: Map<string, User> = new Map(); // nick -> User
const rooms: Map<string, Room> = new Map(); // room_id -> Room



io.on("connection", (socket: Socket) => {
  logger.info(`Connection established with socket ${socket.id}`);


  // Login / Register / Reconnect
  socket.on("login", (data: LoginRequest) => {

    const existingUser = users.get(data.nick);
    if (existingUser) {

      if (data.token !== null) {

        if (existingUser.token === data.token) {

          if (existingUser.socket.id === socket.id) { // TODO: to be deleted when client stops doubling requests
            return;
          }

          logger.info(`Restoring session`, { nick: data.nick });

          existingUser.socket = socket;
          existingUser.socket_id = socket.id;
          sockets.set(socket.id, data.nick);

          if (existingUser.room_id) {
            const room = rooms.get(existingUser.room_id);
            if (room) {
              logger.info(`Rejoining player to room`, { nick: data.nick, roomId: existingUser.room_id });
              room.connect(existingUser);
            } else {
              logger.warn(`User had room_id but room does not exist anymore`, { nick: data.nick, roomId: existingUser.room_id });
              existingUser.room_id = null;
            }
          }

          const res: LoginResponse = {
            success: true,
            nick: existingUser.nick,
            token: existingUser.token,
            restored: true,
            msg: "User restored successfully",
          };
          socket.emit("login_response", res);

        } else {
          logger.warn(`Failed login attempt (token mismatch)`, { nick: data.nick });
          const res: LoginResponse = {
            success: false,
            msg: "Token mismatch.",
          };
          socket.emit("login_response", res);
        }
      } else {
        const res: LoginResponse = {
          success: false,
          msg: "Nick is already taken by another player."
        };
        socket.emit("login_response", res);
      }
    } else {

      const newUser = new User(socket, data.nick);
      newUser.token = data.token || randomUUID();
      users.set(data.nick, newUser);
      sockets.set(socket.id, data.nick);

      logger.info(`New user registered (token: ${newUser.token})`, { nick: data.nick });
      const res: LoginResponse = {
        success: true,
        msg: "User registered successfully.",
        nick: data.nick,
        token: newUser.token,
        restored: false
      };
      socket.emit("login_response", res);
    }
  });


  socket.on("disconnect", (reason) => {
    const nick = sockets.get(socket.id);
    if (!nick) {
      logger.info(`Socket disconnected without being registered. Reason: ${reason} (${socket.id})`);
      return;
    }

    const user = users.get(nick);
    if (!user) {
      sockets.delete(socket.id);
      logger.warn(`User nick found but no user object exists`, { nick: nick });
      return;
    }

    const room_id = user.room_id;
    if (!room_id) {
      logger.info(`Client disconnected, reason: ${reason}`, { nick: nick });
      return;
    }

    const room = rooms.get(room_id);
    if (!room) {
      logger.error("User's room does not exist", { nick: nick, roomId: room_id });
      socket.emit("error", "User's room does not exist");
      return;
    }

    room.mark_as_inactive(user, "disconnected");
    logger.info(`Client marked for removal, reason: ${reason}`, { nick: nick, roomId: room_id });
  });


  // Returns a list of room ids
  socket.on("get_games", () => {
    logger.debug(`Socket requested room list. Total rooms: ${rooms.size}`, { roomId: 'GLOBAL' });
    let res: RoomsResponse = {
      id: []
    };
    for (const room of rooms.values()) {
      res.id.push(room.id);
    }
    socket.emit("game_ids", res);
  });


  // Create a new room
  socket.on("create_game", () => {
    let nick = sockets.get(socket.id);
    if (nick) {
      let user = users.get(nick);
      if (user) {
        let new_room: Room = new Room(io, (id) => {
          rooms.delete(id);
          logger.info(`Room deleted.`, { roomId: id });
        });
        logger.info(`New room created!`, { nick: nick, roomId: new_room.id });

        rooms.set(new_room.id, new_room);
        new_room.connect(user);

        logger.info(`Total active rooms now: ${rooms.size}`);

      } else {
        logger.error(`Create failed: User nick found but no User object`, { nick: nick });
        sockets.delete(socket.id);
        socket.emit("error", `Internal error, please log in again.`);

      }
    } else {
      socket.emit("error", `You are not registered (${socket.id})`);
    }
  });


  // Join a room
  socket.on("join_game", (room_info: RoomRequest) => {
    let nick = sockets.get(socket.id);
    if (nick) {
      let user = users.get(nick);
      if (user) {
        if (user.room_id !== null && user.room_id !== room_info.id) {
          user.send("error", `You are already in a room ${user.room_id}`);
          return;
        }

        const room = rooms.get(room_info.id);
        if (room) {
          logger.info(`Player joining room`, { nick: nick, roomId: room_info.id });
          room.connect(user);

        } else {
          logger.warn(`Join failed: Room not found`, { nick: nick, roomId: room_info.id });
          socket.emit("error", `Requested game does not exist.`);

        }
      } else {
        logger.error(`Join failed: User object missing`, { nick: nick });
        sockets.delete(socket.id);
        socket.emit("error", `Internal error, please log in again.`);
      }
    } else {
      logger.warn(`Join failed: Socket not registered`, { roomId: room_info.id });
      socket.emit("error", `You are not registered (${socket.id})`);
    }
  });


  // Leave a room
  socket.on("leave_game", () => {
    const nick = sockets.get(socket.id);
    let user = nick ? users.get(nick) : null;
    let roomId = user?.room_id || 'UNKNOWN';

    logger.debug(`Socket requested to leave`, { nick: nick || 'UNKNOWN', roomId });

    if (nick) {
      if (user) {
        const room_id = user.room_id;
        if (room_id === null) {
          logger.warn(`Leave failed: User is not in any room`, { nick: nick });
          socket.emit("error", `Can not leave game, because it's null.`);
          return;
        }

        const room = rooms.get(room_id);
        if (room) {
          room.leave(user);
        } else {
          logger.warn(`Leave failed: Room not found`, { nick: nick, roomId: room_id });
          socket.emit("error", `Requested game does not exist.`);
        }

      } else {
        logger.error(`Leave failed: User object missing`, { nick: nick });
        sockets.delete(socket.id);
        socket.emit("error", `Internal error, please log in again.`);
      }
    } else {
      logger.warn(`Leave failed: Socket not registered`);
      socket.emit("error", `You are not registered (${socket.id})`);
    }
  });
});



server.listen(Config.SERVER_PORT, Config.SERVER_IP, () => {
  logger.info(`Server running at ${JSON.stringify(server.address())}`);
});
