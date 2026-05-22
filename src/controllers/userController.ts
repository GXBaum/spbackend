import {type Request, type Response} from "express";
import {prisma} from "../db/prisma.js";

export const postNotificationToken = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const { token } = req.body;

    const result = await prisma.userNotificationToken.create({
        data: {
            token: token,
            userId: id
        }
    });

    res.sendStatus(201);
}