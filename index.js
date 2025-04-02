import { getDb, resetDb, db } from './db/db.js';
import {getLoginCookies} from "./services/auth.js";
import {getCourses} from "./services/courses.js";
import {getMarks} from "./services/marks.js";
import {sendNotification, sendNotificationToUser} from "./services/notifications.js";
import {getTeachers} from "./services/teachers.js";
import express from "express";
import apiRoutes from "./routes/api.js";
import schedule from 'node-schedule';


const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use("/api", apiRoutes);

// TODO: DB GETS RESET EVERY TIME THE SCRIPT RUNS
// WARNING: This will delete all database tables and recreate them
//await resetDb();


// Main function to log in
export async function updateAllSpUserData(SpUsername, SpPassword, schoolId= 6078) {
    try {
        console.time('Script');

        // TODO: remove this
        await db.insertUser(SpUsername, SpPassword, 0);

        console.time('Login');
        const loginCookies = await getLoginCookies(SpUsername, SpPassword, schoolId);
        console.timeEnd('Login');

        console.time("getCourses");
        const courses = await getCourses(loginCookies);
        for (const course of courses) {
            await db.insertCourse({ id: course.id, name: course.name }); // Use db.insertCourse
        }
        console.timeEnd("getCourses");

        //TODO: remove this, hardcoded
        await db.insertUserCourse(SpUsername, 5349)


        console.time("getMarks");

        /*
        console.log(await db.deleteAllMarksOfHalfYear(SpUsername, halfYear));

        for (const course of courses) {
            const marks = await getMarks(loginCookies, course.id, halfYear);

            for (const mark of marks) {
                await db.insertMark({
                    name: mark.name,
                    date: mark.date,
                    grade: mark.grade,
                    courseId: course.id,
                    halfYear: 1,
                    SpUsername: SpUsername,
                });
            }
        }*/
        /*
        // Process both half years
        for (const halfYearToProcess of [1, 2]) {
            await db.deleteAllMarksOfHalfYear(SpUsername, halfYearToProcess); // Delete second half year

            console.log(`Processing half year ${halfYearToProcess}`);
            for (const course of courses) {
                const marks = await getMarks(loginCookies, course.id, halfYearToProcess);

                for (const mark of marks) {
                    await db.insertMark({
                        name: mark.name,
                        date: mark.date,
                        grade: mark.grade,
                        courseId: course.id,
                        halfYear: halfYearToProcess,
                        SpUsername: SpUsername,
                    });
                }
            }
        }
         */
        for (const halfYearToProcess of [1, 2]) {
            const existingMarks = await db.getUserGrades(SpUsername);
            const existingMarksForHalfYear = existingMarks.filter(mark => mark.half_year === halfYearToProcess);

            // Store all new marks for this half year
            const newMarksForHalfYear = [];

            // Collect all new marks from the API
            console.log(`Processing half year ${halfYearToProcess}`);
            for (const course of courses) {
                const marks = await getMarks(loginCookies, course.id, halfYearToProcess);

                marks.forEach(mark => {
                    newMarksForHalfYear.push({
                        name: mark.name,
                        date: mark.date,
                        grade: mark.grade,
                        courseId: course.id,
                        halfYear: halfYearToProcess,
                        SpUsername: SpUsername,
                    });
                });
            }

            // Find truly new marks by comparing name, date and courseId
            const trulyNewMarks = newMarksForHalfYear.filter(newMark => {
                return !existingMarksForHalfYear.some(existingMark =>
                    existingMark.name === newMark.name &&
                    existingMark.date === newMark.date &&
                    existingMark.course_id === newMark.courseId
                );
            });


            const newMarksByCourse = {};
            for (const mark of trulyNewMarks) {
                if (!newMarksByCourse[mark.courseId]) {
                    newMarksByCourse[mark.courseId] = [];
                }
                newMarksByCourse[mark.courseId].push(mark);
            }


            // Send notifications for new marks
            for (const courseId in newMarksByCourse) {
                const courseName = courses.find(c => c.id.toString() === courseId.toString())?.name || "Unbekannter Kurs";
                const newMarks = newMarksByCourse[courseId];

                // Create detailed message about the new marks
                let message = `Du hast ${newMarks.length} neue ${newMarks.length === 1 ? 'Note' : 'Noten'} in ${courseName}:`;
                newMarks.forEach(mark => {
                    message += `\n- ${mark.name}: ${mark.grade}`;
                });

                await sendNotificationToUser(
                    SpUsername,
                    `Neue ${newMarks.length === 1 ? 'Note' : 'Noten'} eingetragen`,
                    message,
                    "high"
                );
            }

            // Now delete and insert all marks
            await db.deleteAllMarksOfHalfYear(SpUsername, halfYearToProcess);

            // Insert all new marks
            for (const mark of newMarksForHalfYear) {
                await db.insertMark(mark);
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
            await db.insertCourseTeacher(relation.courseId, relation.teacherId);
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



function scheduleUpdates() {
    // Run every 5 minutes
    const job = schedule.scheduleJob('*/5 * * * *', async () => {
        console.log('Running scheduled update at', new Date());

        try {
            await updateAllSpUserData("Rafael.Beckmann", "RafaelBigFail5-", 6078);
            console.log('Scheduled update completed successfully');
        } catch (error) {
            console.error('Scheduled update failed:', error);
        }
    });

    console.log('Updates scheduled to run every 5 minutes');
    return job;
}




async function startServer() {
    try {
        await getDb(); // Initialize the database
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);

            // Send a test notification
            const testUserId = "Rafael.Beckmann";
            const testTitle = "Server online";
            const testMessage = "This is a test notification.";
            const testPriority = "high";
            sendNotificationToUser(testUserId, testTitle, testMessage, testPriority)
                .then(() => console.log("Test notification sent"))
                .catch(err => console.error("Test notification error:", err));

            //updateAllSpUserData("Rafael.Beckmann", "RafaelBigFail5-", 1, 6078)

            const updateJob = scheduleUpdates();
            console.log(updateJob);

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