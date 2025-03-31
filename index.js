import { getDb, resetDb, db } from './db/db.js';
import {getLoginCookies} from "./services/auth.js";
import {getCourses} from "./services/courses.js";
import {getMarks} from "./services/marks.js";
import {sendNotification} from "./services/notifications.js";
import {getTeachers} from "./services/teachers.js";
//import * as express from "express";
import express from "express";
import apiRoutes from "./routes/api.js";


const app = express();
const PORT = process.env.PORT || 6000;

app.use(express.json());
app.use("/api", apiRoutes);

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
//main();

async function startServer() {
    try {
        await getDb(); // Initialize the database
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            // Optional: Send a notification once the server is up
            sendNotification(
                "The server sent this",
                "this is insanely cool",
                "high",
                "d_hKZLjIRfe0OilqweAFre:APA91bG_M53-057Lb5bFrg6aSB4fA8pVDZfhV1a_cthGzn1StqIsx8lsw8h2ExtTPA7WxGP1w1ZePywtgpClSKLTas-bi0bLIpOZ5fssZ55ULx21Gi3Obwk"
            ).then(() => console.log("Notification sent"))
                .catch(err => console.error("Notification error:", err));
        });

        // Handle server errors to prevent crashes
        server.on('error', (err) => {
            console.error("Server error:", err);
            process.exit(1);
        });

    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();

process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing server...");
    await db.close();
    process.exit(0);
});