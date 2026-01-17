
import { io } from 'socket.io-client';

export const socket = io(); // Connects to the same host/port as the window (handled by vite proxy)
