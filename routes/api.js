import express from "express";
import {sendNotificationToUser} from "../services/notifications.js";
import {updateAllSpUserData} from "../services/updateAllSpUserData.js";
import db from "../db/insert.js"

const router = express.Router();

router.post('/updateToken', async (req, res) => {
    const {token, spUsername} = req.body;

    console.log(req.body);
    console.log('Received token:', token);
    console.log('For user:', spUsername);

    db.insertUserNotificationToken(spUsername, token).then(
        () => {
            console.log('Token updated successfully');
            res.status(200).json({success: true, message: 'Token updated successfully'});
        }
    )
});

router.get('/getUserMarks', async (req, res) => {
    const spUsername = req.query.spUsername;

    try {
        await sendNotificationToUser("Rafael.Beckmann", "user Noten angefragt", spUsername, "high")
    } catch (error) {
        console.error('Error sending notification:', error);
    }

    db.getUserMarks(spUsername).then((marks) => {
        res.status(200).json({success: true, marks});
    })
});


router.get('/getUserMarksForCourse', async (req, res) => {
    //const spUsername = req.query.spUsername;
    const spUsername = "Rafael.Beckmann";
    const courseId = req.query.courseId;

    console.log('Received :', spUsername);
    console.log('Course ID:', courseId);

    db.getUserMarksForCourse(spUsername, courseId).then((marks) => {
        console.log('Marks:', marks);
        res.status(200).json({success: true, marks});
    }).catch((error) => {
        console.error('Error getting marks:', error);
        res.status(500).json({success: false, message: 'Failed to get marks'});
    });
})

router.get('/triggerUpdate', async (req, res) => {

    console.log('Received trigger update for user:');
    try {
        await updateAllSpUserData("Rafael.Beckmann", "RafaelBigFail5-", 6078)
        res.status(200).json({success: true, message: 'Update triggered successfully'});
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({success: false, message: 'Failed to trigger update'});
    }
});

router.get('/sendNotification' , (req, res) => {

    sendNotificationToUser("Rafael.Beckmann", "test", "test", "high")
        .then(() => {
            res.status(200).json({ success: true, message: 'Notification sent successfully' });
        })
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

router.get('/getUserCourses', async (req, res) => {
    const spUsername = req.query.spUsername;

    console.log('Received :', spUsername);

    db.getUserCourseNames(spUsername).then((courses) => {
        // Rename course_id to courseId in each course object
        const formattedCourses = courses.map(course => ({
            courseId: course.course_id,
            name: course.name
        }));
        console.log('Courses:', formattedCourses);
        res.status(200).json({success: true, courses: formattedCourses});
    }).catch((error) => {
        console.error('Error getting courses:', error);
        res.status(500).json({success: false, message: 'Failed to get courses'});
    });
})






export default router;