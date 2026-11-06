import "dotenv/config";
import {pino} from "pino";

export const logger = pino({
    level: process.env.LOG_LEVEL || "debug",
    //base: {
    //},
    transport: {
        targets: [
            {
                target: "pino-pretty"
            },
            {
                target: "pino-loki",
                options: {
                    host: process.env.LOKI_HOST || "http://localhost:3100",
                    batching: true,
                    labels: {
                        app: "hvk-client-backend"
                    },
                    propsToLabels: ["service"]
                }
            }
        ],
    }
});