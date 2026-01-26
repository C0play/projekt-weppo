export const SERVER_IP: string = "0.0.0.0";
export const SERVER_PORT: number = 3000;

export const CLIENT_PORT: number = 6173;

// Set this IP to that of the device on which the game server runs.
const REMOTE_SERVER_IP: string = "192.168.0.200";

// If undefined or empty, it will use the relative path (Vite proxy).
export const REMOTE_SERVER_URL: string | undefined = `http://${REMOTE_SERVER_IP}:3000`;
