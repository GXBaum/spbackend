import type {Request, Response} from "express";
import {prisma} from "../db/prisma.js";
import {scrapeSp} from "../services/spScraperService.js";
import * as z from "zod";

const cookieSchema = z.object({
    name: z.string(),
    value: z.string(),
    expiresAt: z.number(),
    domain: z.string(),
    path: z.string(),
    secure: z.boolean(),
    httpOnly: z.boolean(),
    persistent: z.boolean(),
    hostOnly: z.boolean()
})
type Cookie = z.infer<typeof cookieSchema>
const cookiesSchema = z.array(cookieSchema)

export const PostAuthCookieSchema = z.object({
    body: z.object({
        cookies: cookiesSchema
    })
})

function formatCookiesForRequest(cookies: Cookie[]) {
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ")
}

export const postAuthCookie = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    // TODO: solve with middleware
    const body = await PostAuthCookieSchema.safeParseAsync(req)
    if (!body.success) return res.sendStatus(400)

    const { cookies } = body.data.body

    const formattedCookie = formatCookiesForRequest(cookies);
    console.log("HERE");
    console.log(cookies);
    console.log(formattedCookie)

    const result = await prisma.userSpData.upsert({
        where: {
            userId: id
        },
        create: {
            spAuthCookie: formattedCookie,
            userId: id
        },
        update: {
            spAuthCookie: formattedCookie
        }
    })

    res.sendStatus(201);
}

export const getTest = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    await scrapeSp(id)

    return res.sendStatus(200)
}