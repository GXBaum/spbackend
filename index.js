import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { getDb, resetDb, db } from './db/db.js';
import {getLoginCookies} from "./services/auth.js";
import {getCourses} from "./services/courses.js";
import {getMarks} from "./services/marks.js";
import {sendNotification} from "./services/notifications.js";
import {getTeachers} from "./services/teachers.js"; // Updated import to use the combined version

//var admin = require("firebase-admin");
//var serviceAccount = require("./hvk-client-firebase-adminsdk-fbsvc-7b316feac0.json");


// TODO: DB GETS RESET EVERY TIME THE SCRIPT RUNS
// WARNING: This will delete all database tables and recreate them
//await resetDb();


// Main function to log in
async function main() {
    try {
        console.time('Script');

        await db.insertUser("Rafael.Beckmann", "RafaelBigFail5-");

        console.time('Login');
        const loginCookies = await getLoginCookies("Rafael.Beckmann", "RafaelBigFail5-", 6078);
        console.timeEnd('Login');

        console.time("getCourses");
        const courses = await getCourses(loginCookies);
        for (const course of courses) {
            await db.insertCourse({ id: course.id, name: course.name }); // Use db.insertCourse
        }
        console.timeEnd("getCourses");

        //new
        await db.insertUserCourse("Rafael.Beckmann", 5349)


        console.time("getMarks");

        console.log(await db.deleteAllMarks("Rafael.Beckmann"));

        for (const course of courses) {
            const marks = await getMarks(loginCookies, course.id, 1);

            for (const mark of marks) {
                await db.insertMark({
                    name: mark.name,
                    date: mark.date,
                    grade: mark.grade,
                    courseId: course.id,
                    SpUsername: "Rafael.Beckmann"
                });
            }
        }
        console.timeEnd("getMarks");

        console.time("getTeachers");
        const { teachers, coursesTeachers } = await getTeachers(loginCookies);
        console.log("Teachers found:", teachers.length);
        console.log("Course-Teacher relationships found:", coursesTeachers.length);

        for (const teacher of teachers) {
            await db.insertTeacher({
                id: teacher.id,
                name: teacher.text,
                type: teacher.type,
                logo: teacher.logo,
                abbreviation: teacher.abbreviation,
                email: teacher.email
            });
        }
        for (const relation of coursesTeachers) {
            await db.insertCourseTeacher(relation.courseId, relation.teacherId); // Use db.insertCourseTeacher
        }
        console.timeEnd("getTeachers");


        console.timeEnd('Script');

    } catch (error) {
        console.error("Error:", error);
        console.timeEnd('Script'); // Ensure it still ends even on error
    } finally {
        await db.close(); // Close the database connection when done
    }
}
main();

//sendNotification("The server sent this", "this is insanely cool", "high", "d_hKZLjIRfe0OilqweAFre:APA91bG_M53-057Lb5bFrg6aSB4fA8pVDZfhV1a_cthGzn1StqIsx8lsw8h2ExtTPA7WxGP1w1ZePywtgpClSKLTas-bi0bLIpOZ5fssZ55ULx21Gi3Obwk");
//sendNotification("The server sent this", "this is insanely cool", "low", "el85NA-0SK6fPLl0UW0MRG:APA91bGuFNNYY797OM1NFXwMRzxjMkHYPM7t9oyZFpaGIIpJ1xpViY0ymqoV9MAUYldqCGOynZBA42_atzfmZZUOzTr4XMTAmqwuPrWm6c3a5oV2heUIbjY");










