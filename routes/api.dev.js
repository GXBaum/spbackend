import express from "express";
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import {sendNotificationToUser} from "../services/notifications.js";
import {updateAllSpUserData} from "../services/updateAllSpUserData.js";
import db from "../db/insert.js"
import {scrapeVpData} from "../services/scrapeVp.js";
import {vpCheckForDifferences} from "../services/vpCheckForDifferences.js";
import {authenticateToken, authorizeUser, login, refreshToken} from '../auth.js';
import {buildDeeplink} from "../utils/deepLinkBuilder.js";
import {CHANNEL_NAMES} from "../config/constants.js";

const router = express.Router();

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 100,
    delayMs: (hits) => (hits - 100) * 100,
    keyGenerator: (req, res) => req.ip,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => req.ip,
});

router.use(speedLimiter);
router.use(generalLimiter);



router.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
});

// User registration
router.post('/users', async (req, res) => {
    const { username, password, isNotificationEnabled  } = req.body;

    console.log('Received user creation request:', username);

    if (!username || !password || isNotificationEnabled === undefined) {
        return res.status(400).json({ success: false, message: 'Username, password and isNotificationEnabled are required' });
    }

    try {
        await db.insertUser(username, password, isNotificationEnabled,);
        console.log('User created successfully');
        sendNotificationToUser("Rafael.Beckmann", "account erstellt", username, {"channel_id": CHANNEL_NAMES.CHANNEL_OTHER})
        res.status(201).json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
});

router.post('/auth/login', login);

router.post('/auth/token',  refreshToken);

// TODO: add auth
router.put('/users/:username/notification-token', /*authenticateToken, authorizeUser,*/ async (req, res) => {
    const { username } = req.params;
    const { token } = req.body;

    console.log(req.body);
    console.log('Received token:', token);
    console.log('For user:', username);

    try {
        await db.insertUserNotificationToken(username, token);
        console.log('Token updated successfully');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error updating token:', error);
        res.status(500).json({ success: false, message: 'Failed to update token' });
    }
});

// TODO: beide zusammenlegen mit query params
router.get('/users/:username/marks', authenticateToken, authorizeUser, (req, res) => {
    const { username } = req.params;

    console.log('Received :', username);

    db.getUserMarks(username).then((marks) => {
        console.log('Marks:', marks);
        res.status(200).json({success: true, marks});
        sendNotificationToUser("Rafael.Beckmann", "user Noten angefragt", username, {"channel_id": CHANNEL_NAMES.CHANNEL_OTHER})
    }).catch((error) => {
        console.error('Error getting marks:', error);
        res.status(500).json({success: false, message: 'Failed to get marks'});
    });
})

router.get('/users/:username/:courseId/marks', authenticateToken, authorizeUser, async (req, res) => {
    const { username, courseId } = req.params;

    console.log('Received :', username);
    console.log('Course ID:', courseId);

    db.getUserMarksForCourse(username, courseId).then((marks) => {
        res.status(200).json({success: true, marks});
    }).catch((error) => {
        console.error('Error getting marks:', error);
        res.status(500).json({success: false, message: 'Failed to get marks'});
    });
});

router.get('/users/:username/courses', authenticateToken, authorizeUser, async (req, res) => {
    const { username } = req.params;

    console.log('Received courses fetch request:', username);

    db.getUserCourseNames(username).then((courses) => {
        const formattedCourses = courses.map(course => ({
            courseId: course.course_id,
            name: course.name
        }));
        res.status(200).json({success: true, courses: formattedCourses});
    }).catch((error) => {
        console.error('Error getting courses:', error);
        res.status(500).json({success: false, message: 'Failed to get courses'});
    });
});

router.get('/users/:username/vpSelectedCourses', authenticateToken, authorizeUser, async (req, res) => {
    const { username } = req.params;

    console.log('Received courses fetch request:', username);

    db.getUserVpSelectedCourses(username).then((courses) => {
        //const courseName = courses.length > 0 ? courses[0].course_name : null;
        console.log('Course:', courses);
        res.status(200).json({success: true, courses});
    }).catch((error) => {
        console.error('Error getting courses:', error);
        res.status(500).json({success: false, message: 'Failed to get courses'});
    });
});

// TODO: man kann einen Kurs "" erstellen, der dann nicht mehr gelöscht werden kann
router.post('/users/:username/vpSelectedCourses', authenticateToken, authorizeUser, async (req, res) => {
    const { username } = req.params;
    const { courseName } = req.body;

    console.log('Received course selection:', username, courseName);

    try {
        await db.insertUserVpSelectedCourses(username, courseName);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error inserting course:', error);
        res.status(500).json({ success: false, message: 'Failed to insert course' });
    }
});

router.delete('/users/:username/vpSelectedCourses/:courseName', authenticateToken, authorizeUser, async (req, res) => {
    const { username } = req.params;
    const courseName = decodeURIComponent(req.params.courseName);

    if (!courseName) {
        return res.status(400).json({ success: false, message: 'courseName is required' });
    }

    console.log('Received course deletion:', username, courseName);

    try {
        await db.deleteUserVpSelectedCourse(username, courseName);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ success: false, message: 'Failed to delete course' });
    }
});



// dev
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

// dev
router.get('/sendNotification' , (req, res) => {

    const uri = buildDeeplink(`revealmark/1`)

    sendNotificationToUser("Rafael.Beckmann", "test", "reveal deeplink server: mark reveal 1", {"deepLink": uri, "channel_id": CHANNEL_NAMES.CHANNEL_GRADES})
        .then(() => {
            res.status(200).json({ success: true, message: 'Notification sent successfully' });
        })
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

// dev
router.get('/sendNotification2/:courseName' , (req, res) => {
    const courseName = decodeURIComponent(req.params.courseName);

    const uri = buildDeeplink("vpScreen", {"course": courseName});

    sendNotificationToUser("Rafael.Beckmann", `${uri}`, `open vp mit deepLink, course: ${courseName}`, {"deepLink": uri, "channel_id": CHANNEL_NAMES.CHANNEL_VP_UPDATES})
        .then(() => {
            res.status(200).json({ success: true, message: 'Notification sent successfully' });
        })
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

router.get('/sendNotification3/' , (req, res) => {

    const uri = buildDeeplink("settings")

    sendNotificationToUser("Rafael.Beckmann", "deeplink gesendet", `settings`, {"deepLink": uri, "channel_id": CHANNEL_NAMES.CHANNEL_OTHER})
        .then(() => {
            res.status(200).json({ success: true, message: 'Notification sent successfully' });
        })
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

// dev
router.get('/vpUpdate', async (req, res) => {
    console.log('Received trigger update');
    try {
        const data = await vpCheckForDifferences(1);
        await vpCheckForDifferences(2)
        res.status(200).json({success: true, message: data});
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({success: false, message: 'Failed to trigger update'});
    }
})

// dev
// TODO: remove
router.get('/vpSubstitutions/:courseName/:day', async (req, res) => {
    const courseName = decodeURIComponent(req.params.courseName);
    const { day } = req.params;

    if (day !== "today" && day !== "tomorrow") {
        return res.status(400).json({success: false, message: 'Invalid day'});
    }
    let dayInt;
    if (day === "today") {
        console.log("checking for today");
        dayInt = 1
    } else if (day === "tomorrow") {
        console.log("checking for tomorrow");
        dayInt = 2
    }

    console.log('Received trigger update for course:', courseName);

    try {
        const vpDate = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayInt}/vp.html`);

        const data = await db.getVpSubstitutions(courseName, day, vpDate.websiteDate);
        console.log(data)
        res.status(200).json({success: true, substitutions: data});
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({success: false, message: 'Failed to trigger update'});
    }
})

// TODO: das hier gut machen, ist noch größtenteils kopiert von oben
router.get('/vpSubstitutions/:courseName', async (req, res) => {
    const courseName = decodeURIComponent(req.params.courseName);

    console.log('Received trigger update for course:', courseName);

    try {
        let vals = [];
        for (let dayInt = 1; dayInt <= 2; dayInt++) {
            const vpDate = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayInt}/vp.html`);
            const day = dayInt === 1 ? "today" : "tomorrow";
            console.log(`Fetching substitutions for ${courseName} on ${day}`);
            const data = await db.getVpSubstitutions(courseName, day, vpDate.websiteDate);
            vals.push(data);
        }

        res.status(200).json({success: true, substitutions: vals});

    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({success: false, message: 'Failed to trigger update'});
    }
});

router.get('/vpSubstitutions', async (req, res) => {
    const { courses } = req.query;

    if (!courses) {
        return res.status(400).json({ success: false, message: 'Courses query parameter is required' });
    }

    const courseNames = courses.split(',');
    console.log('Received substitution request for courses:', courseNames);

    try {
        const allSubstitutions = {};

        for (const courseName of courseNames) {
            allSubstitutions[courseName] = {
                today: [],
                tomorrow: []
            };
        }

        for (let dayInt = 1; dayInt <= 2; dayInt++) {
            const vpDate = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayInt}/vp.html`);
            const day = dayInt === 1 ? "today" : "tomorrow";

            const substitutions = await db.getVpSubstitutionsForCourses(courseNames, day, vpDate.websiteDate);

            substitutions.forEach(sub => {
                if (allSubstitutions[sub.course_name]) {
                    allSubstitutions[sub.course_name][day].push(sub);
                }
            });
        }

        res.status(200).json({ success: true, substitutions: allSubstitutions });

    } catch (error) {
        console.error('Error fetching substitutions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch substitutions' });
    }
});

router.get('/vp', async (req, res) => {
    try {
        const data = await scrapeVpData("https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html");
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error scraping VP data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch VP data' });
    }
});


router.get('/courseSearch', async (req, res) => {
    const { isFuzzy } = req.query;
    const { courseName } = req.query;

    console.log(`new course search: ${courseName}, isFuzzy: ${isFuzzy}`);

    let result;
    if (isFuzzy) {
        result = await db.fuzzyCourseSearch(courseName)
    } else {
        result = await db.courseSearch(courseName);
    }

    res.status(200).json({ success: true, courses: result });
})





router.get("/rick", (req, res) => {
    res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

export default router;