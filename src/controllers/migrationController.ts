import type {Request, Response} from "express";
import {prisma} from "../db/prisma.js";
import * as z from "zod";
import {signAccessToken} from "./authController.js";
import {logger} from "../logger.js";

const log = logger.child({ service: "migration" });

const vpCourseSchema = z.object({
    course: z.string(),
    created_at: z.string()
});
const notificationTokenSchema = z.object({
    token: z.string(),
    created_at: z.string()
});
const refreshTokenSchema = z.object({
    token: z.string(),
    expires_at: z.string(),
    created_at: z.string()
});

export const GetMigrationResponseSchema = z.object({
    data: z.object({
        user: z.object({
            id: z.number(),
            created_at: z.string(),
            updated_at: z.string(),
            notifications_enabled: z.number()
        }),
        courses: z.array(vpCourseSchema),
        notificationTokens: z.array(notificationTokenSchema),
        refreshTokens: z.array(refreshTokenSchema)
    })
})

const migrationRequestParams = z.object({
    userIdOld: z.string().min(1)
});

const migrationRequestQuery = z.object({
    refreshTokenInRequest: z.string().min(1)
});

export const getDevV1 = async (req: Request, res: Response) => {

    const parsedParams = migrationRequestParams.safeParse(req.params)
    if (!parsedParams.success) return res.sendStatus(400)

    const parsedQuery = migrationRequestQuery.safeParse(req.query)
    if (!parsedQuery.success) return res.sendStatus(400)

    const userIdOld = parsedParams.data.userIdOld
    const refreshTokenInRequest = parsedQuery.data.refreshTokenInRequest

    log.info({userIdOld}, "migration started");

    // TODO: disable notifications on old server after migration
    const params = new URLSearchParams({
        refreshToken: refreshTokenInRequest
    })
    const response = await fetch(
        `https://rafaelbeckmann.de/api/dev/migrations/dev-v1/${userIdOld}?${params.toString()}`,
        /*
        {
            headers: {
                "Authorization": authHeader
            },
        }
        */
    )
    if (!response.ok) {
        log.error({userIdOld, status: response.status}, "failed to fetch migration data");
        return res.sendStatus(response.status)
    }

    const rawData = await response.json(); // TODO: ts doesn't work
    log.debug({rawData});
    const parsedData = await GetMigrationResponseSchema.safeParseAsync(rawData);

    if (!parsedData.success) {
        log.error({userIdOld, err: parsedData.error}, "failed to parse migration data");
        return res.sendStatus(500)
    }
    const data = parsedData.data.data

    console.log(data);


    const user = await prisma.user.create({
        data: {
            createdAt: data.user.created_at,
            vpCourses: {
                createMany: {
                    data: data.courses.map(course => ({
                        course: course.course,
                        createdAt: course.created_at
                    })),
                    skipDuplicates: true
                }
            },
            notificationTokens: {
                createMany: {
                    data: data.notificationTokens.map(token => ({
                        token: token.token,
                        createdAt: token.created_at
                    })),
                    skipDuplicates: true
                }
            },
            refreshTokens: {
                createMany: {
                    data: data.refreshTokens.map(token => ({
                        token: token.token,
                        createdAt: token.created_at
                    })),
                    skipDuplicates: true
                }
            }
        }
    });

    log.info({
        userIdOld,
        userId: user.id,
        courseCount: data.courses.length,
        tokenCount: data.notificationTokens.length,
    }, "migration completed");

    const token = signAccessToken(user.id);

    res.send({id: user.id, token});
}