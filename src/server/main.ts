import express from 'express';
import type { Request, Response } from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server, Socket } from 'socket.io';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { Game, Player } from './game'

const app = express();
const server = createServer(app);
const io = new Server(server);


let nicks = new Set<string>();
let games = new Map<string, Game>();
let rooms = new Map<string, string>(); // nick -> room


app.get('/', (req: Request, res: Response) => {
    res.sendFile(join(__dirname, '../../client', 'index.html'));
});


io.on('connection', (socket: Socket) => {

    // Nick creation
    socket.on('create_nick', (nick: string) => {
        console.log(socket.id + ' new_nick: ' + nick)
        if (nicks.has(nick)) {
            socket.emit("nick_status", { available: false, nick });
        } else {
            nicks.add(nick);
            socket.emit("nick_status", { available: true, nick });
        }
    });

    socket.on('disconnect', (nick: string) => {
        nicks.delete(nick);
        rooms.delete(nick);
    });

    // Get games
    socket.on('get_games', () => {
        let game_ids: Array<string> = new Array();
        games.forEach((game, id) => {
            if (game.number_of_players < game.max_players) {
                game_ids.push(id)
            }
        })
        socket.emit("game_ids", game_ids)
    })

    // Add game
    socket.on('add_game', (nick: string) => {
        let new_game: Game = new Game()
        new_game.add_player(new Player(nick))

        games.set(new_game.uid, new_game)
        rooms.set(nick, new_game.uid)

        socket.join(new_game.uid)
        socket.emit("game_added", new_game)
    })
    
    // Enter game
    socket.on('connect', (nick: string, game_id: string) => {
        const game = games.get(game_id);
        if (game === undefined) {
            socket.emit("error", { msg: "no game with " + game_id + " found" })
            return
        }
        game.add_player(new Player(nick))
        rooms.set(nick, game.uid)
        
        socket.join(game.uid)
        io.to(game.uid).emit("game", game)
    })

    // 
});


server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});