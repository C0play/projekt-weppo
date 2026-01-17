import express from 'express';
import type { Request, Response } from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server, Socket } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);


app.get('/', (req: Request, res: Response) => {
    res.sendFile(join(__dirname, '../../client', 'index.html'));
});


let nicks = new Set<string>();

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
    });

    // Rooms
    socket.on('get_rooms', () => {

    })
});



server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});