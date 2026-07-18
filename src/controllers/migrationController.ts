import type {Request, Response} from "express";
import {prisma} from "../db/prisma.js";
import * as z from "zod";
import {signAccessToken} from "./authController.js";

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
    /*
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.sendStatus(401)
    */
    //console.log(authHeader)

    const parsedParams = migrationRequestParams.safeParse(req.params)
    if (!parsedParams.success) return res.sendStatus(400)

    const parsedQuery = migrationRequestQuery.safeParse(req.query)
    if (!parsedQuery.success) return res.sendStatus(400)

    const userIdOld = parsedParams.data.userIdOld
    const refreshTokenInRequest = parsedQuery.data.refreshTokenInRequest

    console.log(`user ${userIdOld} is migrating...`)

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
        console.log("Failed to fetch migration data: ", await response.text())
        return res.sendStatus(response.status)
    }

    console.log("Received migration data")

    const rawData = await response.json(); // TODO: ts doesn't work
    console.log(rawData)
    const parsedData = await GetMigrationResponseSchema.safeParseAsync(rawData);

    if (!parsedData.success) {
        console.log("Failed to parse migration data: ", parsedData.error)
        return res.sendStatus(500)
    }
    const data = parsedData.data.data


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
    })

    const token = signAccessToken(user.id);

    res.send({id: user.id, token});
}