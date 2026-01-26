import { io } from "socket.io-client";
import { Config } from "../shared/config";

// Use shared Config to construct server URL in dev; in production rely on same-origin (no host)
const devUrl = `http://${Config.SERVER_IP}:${Config.SERVER_PORT}`;
const url = import.meta.env.DEV ? devUrl : undefined;

export const socket = io(url ?? undefined, { autoConnect: false });
