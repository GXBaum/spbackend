import type {NextFunction, Request, Response} from "express";
import {logger} from "../logger.js";

const log = logger.child({ service: "http" });

function logLevelForStatus(statusCode: number): "info" | "warn" | "error" {
    if (statusCode >= 500) return "error";
    if (statusCode === 401 || statusCode === 403) return "info";
    if (statusCode >= 400) return "warn";
    return "info";
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const { method, originalUrl, ip } = req;

    const startDate = Date.now();

    res.on("finish", () => {
        const responseTime = Date.now() - startDate;
        const statusCode = res.statusCode;
        const route = typeof req.route?.path === "string" ? req.baseUrl + req.route.path : undefined;

        log[logLevelForStatus(statusCode)]({
            request: {
                method,
                url: originalUrl,
                route,
                ip
            },
            response: {
                statusCode,
                responseTime
            }
        }, "request completed");
    });

    next();
}
