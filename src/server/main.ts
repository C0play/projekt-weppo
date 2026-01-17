import express from "express";
import type { Request, Response } from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server, Socket } from "socket.io";

import { Game, Player } from "./game";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: [ "GET", "POST" ]
  }
});

let nicks = new Set<string>();
let games = new Map<string, Game>(); // game_id -> Game
let rooms = new Map<string, string>(); // nick -> game_id/room_name

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(join(__dirname, "../../client", "index.html"));
});

io.on("connection", (socket: Socket) => {
  // Nick creation
  socket.on("create_nick", (nick: string) => {
    console.log(socket.id + " new_nick: " + nick);
    if (nicks.has(nick)) {
      socket.emit("nick_status", { available: false, nick });
      console.log("sending ack false");
    } else {
      nicks.add(nick);
      socket.emit("nick_status", { available: true, nick });
      console.log("sending ack true");
    }
  });

  socket.on("disconnect", (nick: string) => {
    nicks.delete(nick);
    rooms.delete(nick);
    // delete player from games
  });

  // Get games
  socket.on("get_games", () => {
    let game_ids: Array<string> = new Array();
    games.forEach((game, id) => {
      if (game.number_of_players < game.max_players) {
        game_ids.push(id);
      }
    });
    socket.emit("game_ids", game_ids);
  });

  // Add game
  socket.on("add_game", (nick: string) => {
    let new_game: Game = new Game();
    new_game.add_player(new Player(nick));

    games.set(new_game.uuid, new_game);
    rooms.set(nick, new_game.uuid);

    socket.join(new_game.uuid);
    socket.emit("game_added", new_game);
  });

  // Enter game
  socket.on("join_game", (nick: string, game_id: string) => {
    const game = games.get(game_id);
    if (game === undefined) {
      socket.emit("error", { msg: "no game with " + game_id + " found" });
      return;
    }
    // validate uniquee nick

    console.debug("adding " + nick);
    game.add_player(new Player(nick));
    rooms.set(nick, game.uuid);

    socket.join(game.uuid);
    io.to(game.uuid).emit("game", game);

  });

  // Leave game
  socket.on("leave_game", (nick: string, game_id: string) => {
    const game = games.get(game_id);
    if (game === undefined) {
      socket.emit("error", { msg: "no game with " + game_id + " found" });
      return;
    }
    // game.delete_player(nick)

    rooms.delete(nick);

    io.to(game.uuid).emit("game", game);
  });

  // 

});

server.listen(3000, "0.0.0.0", () => {
  console.log("server running at ", server.address());
});
