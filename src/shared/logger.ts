import winston from "winston";

const { combine, timestamp, printf, colorize } = winston.format;

interface LogInfo extends winston.Logform.TransformableInfo {
    roomId?: string;
    nick?: string;
    timestamp?: string;
}

const logFormat = printf((info: winston.Logform.TransformableInfo) => {
    const { timestamp, level, message, roomId, nick } = info as LogInfo;
    const roomPart = roomId ? ` [${roomId.substring(0, 6)}]` : ' [-]'; // Consistent placeholders
    const nickPart = nick ? ` [${nick}]` : ' [-]';
    return `[${timestamp}] ${level}:${roomPart}${nickPart} ${message}`;
});

export const logger = winston.createLogger({
    level: /* process.env.LOG_LEVEL || */ "debug",
    format: combine(
        colorize({ all: true }),
        timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        logFormat
    ),
    transports: [
        new winston.transports.Console(),
    ],
});
