import {type Request, type Response} from "express";
import {scrapeVp} from "../services/vpScraperService.js";
import {Day} from "../generated/prisma/enums.js";
import {prisma} from "../db/prisma.js";
import {Prisma} from "../generated/prisma/client.js";

function castAsDay(value: any): Day | null {
    if( Object.values(Day).includes(value) ) {
        return value as Day
    } else {
        return null
    }
}

export const getSubstitutions = async (req: Request, res: Response): Promise<void> => {
    const { courses, /*day*/ } = req.query;

    const whereStatement: Prisma.VpSubstitutionWhereInput = {};

    // enforce array
    const coursesArray = (courses
        ? (Array.isArray(courses) ? courses : [courses]) // to array if not null
        : [] // fallback if null
    ) as string[];

    // if no courses query param, get all
    if (coursesArray.length > 0) {
        whereStatement.courseName = { in: coursesArray }
    }

    /*const dayCast = castAsDay(day);
    if (dayCast) {
        whereStatement.day = dayCast
    }*/


    const days = await prisma.vpDay.findMany({
        orderBy: {
            targetDate: "desc"
        },
        take: 2,
        include: {
            infos: true
        }
    });
    console.log(days);

    whereStatement.targetDate = { in: days.map(day => day.targetDate) }

    const result = await prisma.vpSubstitution.findMany({
        where: whereStatement
    });

    const dayEntries = [
        { key: "today", day: days[1] },
        { key: "tomorrow", day: days[0] }
    ]

    const substitutions: { [day: string]: any } = {};

    for (const { key, day } of dayEntries) {
        if (!day) continue;

        substitutions[key] = {
            targetDate: day.targetDate,
            dayString: day.websiteDate,
            info: day.infos,
            substitutions: result.filter(sub =>
                sub.targetDate.getDate() === day.targetDate.getDate()
            )

            // TODO: One remaining bug to consider
            // You are still using:
            // sub.targetDate.getDate() === day.targetDate.getDate()
            // That compares only the day of the month, not the full date.
            // If the same number appears in different months, it can match incorrectly.
            // Safer version:
            // sub.targetDate.getTime() === day.targetDate.getTime()
            // Since targetDate comes from the DB and should be the exact same date for those rows, this is the better comparison.
        }
    }

    res.send({
        substitutions
    });
};


export const postSubstitutions = async (req: Request, res: Response) => {
    const result = await scrapeVp(Day.today)
    await scrapeVp(Day.tomorrow)

    res.send(result);
}

// TODO: potentially move to a different file
export const getCourses = async (req: Request, res: Response)=> {
    const { search } = req.query;

    if (typeof search != "string") return res.sendStatus(400);

    const result = await prisma.vpCourse.findMany({
        where: {
            name: {
                contains: search,
                mode: "insensitive"
            }
        }
    })

    res.send({
        courses: result
    })
}