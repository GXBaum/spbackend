import type {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";
import {logger} from "../logger.js";

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1]
    if (!token) return res.sendStatus(401)

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("Missing JWT_SECRET env variable") // TODO: should this throw? maybe? i don't know
    }

    try {
        const user = jwt.verify(
            token,
            secret
        );

        if (typeof user == "string" || typeof user.id != "string"){
            return res.sendStatus(401);
        }

        logger.debug({user});

        req.user = user as NonNullable<Request["user"]>;
        next();
    } catch (error) {
        logger.error({err: error}, "auth failed");
        return res.sendStatus(401);
    }

}