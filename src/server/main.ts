import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";

import { Room } from "./room";
import { User } from "./user";
import {
  LoginRequest, LoginResponse,
  RoomRequest, RoomsResponse
} from "./types";
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
            logger.debug(`Duplicate login request from ${data.nick} on same socket ${socket.id}`);
            return;
          }

          logger.info(`Restoring session of ${data.nick}`);

          existingUser.socket = socket;
          existingUser.socket_id = socket.id;
          sockets.set(socket.id, data.nick);

          if (existingUser.room_id) {
            const room = rooms.get(existingUser.room_id);
            if (room) {
              logger.info(`Rejoining player ${existingUser.nick} to room ${existingUser.room_id}`);
              room.connect(existingUser);
            } else {
              logger.warn(`User ${existingUser.nick} had room_id ${existingUser.room_id} but room does not exist anymore`);
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
          logger.warn(`Failed login attempt for ${data.nick} (token mismatch - ${data.token} : ${existingUser.token})`);
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

      logger.info(`New user: ${data.nick} (token: ${newUser.token})`);
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
      logger.info(`Socket ${socket.id} disconnected without being registered. Reason: ${reason}`);
      return;
    }

    const user = users.get(nick);
    if (!user) {
      sockets.delete(socket.id);
      logger.warn(`User nick ${nick} found for socket ${socket.id} but no user object exists`);
      return;
    }

    const room_id = user.room_id;
    if (!room_id) {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
      return;
    }

    const room = rooms.get(room_id);
    if (!room) {
      logger.error("User's room does not exist");
      socket.emit("error", "User's room does not exist");
      return;
    }

    room.mark_as_inactive(user, "disconnected");
    logger.info(`Client marked for removal: ${socket.id}, reason: ${reason}`);
  });

  // Returns a list of room ids
  socket.on("get_games", () => {
    logger.debug(`Socket ${socket.id} requested room list. Total rooms: ${rooms.size}`);
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
          logger.info(`Room ${id} deleted because it became empty.`);
        });
        logger.info(`New room created! ID: ${new_room.id} Owner: ${nick}`);

        new_room.connect(user);
        rooms.set(new_room.id, new_room);
        user.room_id = new_room.id;

        logger.info(`Total active rooms now: ${rooms.size}`);
        socket.emit("game", new_room.game);
      } else {
        logger.error(`Create failed: User nick ${nick} found but no User object for socket ${socket.id}`);
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
        const room = rooms.get(room_info.id);
        if (room) {
          logger.info(`Player ${nick} joining room ${room_info.id}`);
          room.connect(user);
          user.room_id = room.id;
        } else {
          logger.warn(`Join failed: Room ${room_info.id} not found for user ${nick}`);
          socket.emit("error", `Requested game does not exist.`);
        }
      } else {
        logger.error(`Join failed: User object missing for nick ${nick}`);
        sockets.delete(socket.id);
        socket.emit("error", `Internal error, please log in again.`);
      }
    } else {
      logger.warn(`Join failed: Socket ${socket.id} not registered`);
      socket.emit("error", `You are not registered (${socket.id})`);
    }
  });

  // Leave a room
  socket.on("leave_game", (room_info: RoomRequest) => {
    let nick = sockets.get(socket.id);
    if (nick) {
      let user = users.get(nick);
      if (user) {
        const room = rooms.get(room_info.id);
        if (room) {
          logger.info(`Player ${nick} requested to leave room ${room_info.id}`);
          room.mark_as_inactive(user, "left");
          user.room_id = null;
        } else {
          logger.warn(`Leave failed: Room ${room_info.id} not found for user ${nick}`);
          socket.emit("error", `Requested game does not exist.`);
        }
      } else {
        logger.error(`Leave failed: User object missing for nick ${nick}`);
        sockets.delete(socket.id);
        socket.emit("error", `Internal error, please log in again.`);
      }
    } else {
      logger.warn(`Leave failed: Socket ${socket.id} not registered`);
      socket.emit("error", `You are not registered (${socket.id})`);
    }
  });
});



server.listen(Config.SERVER_PORT, Config.SERVER_IP, () => {
  logger.info(`server running at ${JSON.stringify(server.address())}`);
});
