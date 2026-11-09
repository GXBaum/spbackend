import {type Request, type Response} from "express";
import {prisma} from "../db/prisma.js";

export const getEnrolled = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const enrolled = await prisma.userVpCourse.findMany({
        where: {
            userId: id
        },
        select: {
            id: true,
            course: true,
            createdAt: true,
            updatedAt: true
        }
    });

    const verified = await prisma.vpCourse.findMany({
        where: {
            name: {
                in: enrolled.map(course => course.course)
            }
        }
    })

    const verifiedNamesSet = new Set(
        verified.map(c => c.name)
    )

    const enrolledWithVerified = enrolled.map( e => ({
        ...e,
        verified: verifiedNamesSet.has(e.course)
    }))

    res.send({
        courses: enrolledWithVerified
    });
}

// TODO: should this be put? yeah
// TODO: implement
export const postEnrolled = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const { course } = req.body;

    const result = await prisma.userVpCourse.create({
        data: {
            course: course,
            userId: id
        }
    });

    res.sendStatus(201);
}

export const deleteEnrolled = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) return res.sendStatus(401);

    const { courseId } = req.params;
    if (typeof courseId !== "string" || !courseId) return res.sendStatus(400);

    // deleteMany to not throw when no row matches
    const { count } = await prisma.userVpCourse.deleteMany({
        where: {
            id: courseId,
            userId: userId
        }
    });

    if (count === 0) return res.sendStatus(404);
    return res.sendStatus(204);
}
