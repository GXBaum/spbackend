import type {Request, Response} from "express";
import {prisma} from "../db/prisma.js";
import {scrapeSp, scrapeSpCourse} from "../services/spScraperService.js";
import * as z from "zod";
import {logger} from "../logger.js";
import type {MulticastMessage} from "firebase-admin/messaging";
import {CHANNEL_NAMES} from "../services/DeepLinkBuilder.js";

const log = logger.child({ service: "sp" });

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
    log.info({userId: id, cookies: cookies, formattedCookie: formattedCookie}, "SP auth cookie stored");

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
    });

    res.sendStatus(201);
}

export const getTest = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);



    await scrapeSp(id)



    const tokens = await prisma.userNotificationToken.findMany({
        where: {
            userId: id
        }
    })

    if (tokens.length === 0) {
        log.debug({id}, "test skipped: no notification tokens");
        return;
    }

    const title = "test";
    const body = Math.random().toString()

    const message: MulticastMessage = {
        tokens: tokens.map(row => row.token),
        data: {
            title: title,
            body: body,
            //notification_tag: "test"
            channel_id: CHANNEL_NAMES.CHANNEL_VP_UPDATES, // TODO: improve this
        }
    }
    await messaging.sendEachForMulticast(message)


    return res.sendStatus(200)
}

export const getCourses = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const result = await prisma.userSpCache.findFirst({
        where: {
            userId: id
        },
        select: {
            coursesEncryptedJson: true
        }
    })


    return res.send({
        courses: result?.coursesEncryptedJson ?? ""
    })
}


export const GetCourseMarksSchema = z.object({
    params: z.object({
        courseId: z.string()
    })
})

export const getCourseMarks = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const request = await GetCourseMarksSchema.safeParseAsync(req)
    if (!request.success) return res.sendStatus(400)
    const requestData = request.data

    log.debug({userId: id, courseId: requestData.params.courseId}, "fetching course marks");

    const result = await scrapeSpCourse(id, Number(requestData.params.courseId), 2)

    res.send({
        marks: result
    })
}


export const getChats = (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    return ""
}