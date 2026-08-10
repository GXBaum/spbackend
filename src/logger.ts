import {pino} from "pino";

export const logger = pino({
    level: process.env.LOG_LEVEL || "debug",
    base: {
    },
    transport: {
        targets: [
            {
                target: "pino-pretty"
            },
            {
                target: "pino-loki",
                options: {
                    host: "http://localhost:3100"
                }
            }
        ],
    },

});