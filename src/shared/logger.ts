import winston from "winston";

const { combine, timestamp, printf, colorize, align } = winston.format;

const logFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
});

export const logger = winston.createLogger({
    level: /* process.env.LOG_LEVEL || */ "debug",
    format: combine(
        colorize({ all: true }),
        timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        align(),
        logFormat
    ),
    transports: [
        new winston.transports.Console(),
    ],
});
