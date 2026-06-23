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


    const databaseDayTest = await prisma.vpDay.findMany({
        orderBy: {
            targetDate: "desc"
        },
        take: 2
    });
    console.log(databaseDayTest);
    whereStatement.targetDate = { in: databaseDayTest.map(day => day.targetDate) }



    const result = await prisma.vpSubstitution.findMany({
        where: whereStatement
    });

    console.log(result)

    const today = databaseDayTest[1]
    const tomorrow = databaseDayTest[0]

    const response = {
        substitutions: {
            // TODO: infos, fehlende klassen etc fehlt

            today: {
                targetDate: today?.targetDate,
                dayString: today?.websiteDate,
                info: today?.vpInfos,
                substitutions: result.filter(sub =>
                    sub.targetDate.getDate() === today?.targetDate.getDate()
                )
            },
            tomorrow: {
                targetDate: tomorrow?.targetDate,
                dayString: tomorrow?.websiteDate,
                info: tomorrow?.vpInfos,
                substitutions: result.filter(sub =>
                    sub.targetDate.getDate() === tomorrow?.targetDate.getDate()
                )
            }
        }
    }

    res.send(response);
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