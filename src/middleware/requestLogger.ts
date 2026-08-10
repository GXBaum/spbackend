import type {NextFunction, Request, Response} from "express";
import {logger} from "../logger.js";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const { method, url, ip } = req;

    const startDate = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - startDate;
        const statusCode = res.statusCode;

        logger.info({
            request: {
                method,
                url,
                ip
            },
            response: {
                statusCode,
                duration
            }
        }, "request oder so idk");
    });

    next();
}