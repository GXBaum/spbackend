import type {Request, Response} from "express";
import {prisma} from "../db/prisma.js";
import * as z from "zod";

const vpCourse = z.object({
    course: z.string(),
    createdAt: z.string()
})
const notificationToken = z.object({
    token: z.string(),
    createdAt: z.string()
})
const refreshToken = z.object({
    token: z.string(),
    expiresAt: z.string(),
    createdAt: z.string()
})

export const GetMigrationResponseSchema = z.object({
    body: z.object({
        user: z.object({
            userId: z.number(),
            createdAt: z.string(),
            updatedAt: z.string(),
        }),
        courses: z.array(vpCourse),
        notificationTokens: z.array(notificationToken),
        refreshTokens: z.array(refreshToken)
    })
})




export const getDevV1 = async (req: Request, res: Response) => {

    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.sendStatus(401)

    const response = await fetch(
        "https://rafaelbeckmann.de/api/dev/migrations/dev-v1",
        {
            headers: {
                "Authorization": authHeader
            }
        }
    )
    if (!response.ok) {
        return res.sendStatus(500)
    }

    const rawData = await response.json(); // TODO: ts doesn't work

    const data = await GetMigrationResponseSchema.safeParseAsync(rawData);
    if (!data.success) return res.sendStatus(400)

    res.send({
        courses: null
    });
}