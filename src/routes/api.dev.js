import express from "express";
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import {sendNotificationToUser} from "../services/notifications.js";
import {updateAllSpUserData} from "../services/updateAllSpUserData.js";
import {scrapeVpData} from "../services/scrapeVp.js";
import {vpCheckForDifferences} from "../services/vpCheckForDifferences.js";
import {authenticateToken, authorizeUser, login, refreshToken} from '../auth.js';
import {buildDeeplink} from "../utils/deepLinkBuilder.js";
import {CHANNEL_NAMES} from "../config/constants.js";
import {aiTest} from "../aiTest.js";
import {createDefaultVpRepository} from "../db/repositories/vpRepository.js";
import {createDefaultUserRepository} from "../db/repositories/userRepository.js";
import {createDefaultAuthRepository} from "../db/repositories/authRepository.js";
import {createDefaultMarkRepository} from "../db/repositories/marksRepository.js";
import {createDefaultCourseRepository} from "../db/repositories/courseRepository.js";
import {createDefaultNotificationsRepository} from "../db/repositories/notificationsRepository.js";

const vpRepo = createDefaultVpRepository();
const userRepo = createDefaultUserRepository();
const authRepo = createDefaultAuthRepository();
const markRepo = createDefaultMarkRepository();
const courseRepo = createDefaultCourseRepository();
const notificationsRepo = createDefaultNotificationsRepository();

const router = express.Router();

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 100,
    delayMs: (hits) => (hits - 100) * 100,
    keyGenerator: (req) => req.ip,
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
});

router.use(speedLimiter);
router.use(generalLimiter);

router.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
});

// User registration
// TODO directly return auth
router.post('/users', async (req, res) => {
    const { isNotificationEnabled  } = req.body;

    console.log('Received user creation request:', username);

    if (isNotificationEnabled === undefined) {
        return res.status(400).json({ success: false, message: 'isNotificationEnabled are required' });
    }
    try {
        const userId = await userRepo.insertUser(isNotificationEnabled);
        console.log('User created successfully');
        await sendNotificationToUser(1, "account erstellt", { "channel_id": CHANNEL_NAMES.CHANNEL_OTHER });
        res.status(201).json({ success: true, message: 'User created successfully', userId });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
});

router.post('/auth/login', login);
router.post('/auth/token', refreshToken);

// TODO: add auth
router.put('/users/:userId/notification-token', /*authenticateToken, authorizeUser,*/ async (req, res) => {
    const { userId } = req.params;
    const { token } = req.body;

    console.log(req.body);
    console.log('Received token:', token);
    console.log('For user:', userId);

    try {
        notificationsRepo.addUserNotificationToken(userId, token);
        console.log('Token updated successfully');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error updating token:', error);
        res.status(500).json({ success: false, message: 'Failed to update token' });
    }
});

// Marks (all)
router.get('/users/:userId/marks', authenticateToken, authorizeUser, (req, res) => {
    const { userId } = req.params;
    try {
        const marks = markRepo.getUserMarks(userId)
        res.status(200).json({ success: true, marks });
        sendNotificationToUser(1, "user Noten angefragt", username, { "channel_id": CHANNEL_NAMES.CHANNEL_OTHER }).catch(()=>{});
    } catch (error) {
        console.error('Error getting marks:', error);
        res.status(500).json({ success: false, message: 'Failed to get marks' });
    }
});

// Marks (by course)
router.get('/users/:userId/:courseId/marks', authenticateToken, authorizeUser, (req, res) => {
    const { userId, courseId } = req.params;
    try {
        const marks = markRepo.getUserMarksForCourse(userId, courseId);
        res.status(200).json({ success: true, marks });
    } catch (error) {
        console.error('Error getting marks:', error);
        res.status(500).json({ success: false, message: 'Failed to get marks' });
    }
});

// Courses
router.get('/users/:userId/courses', authenticateToken, authorizeUser, (req, res) => {
    const { userId } = req.params;
    try {
        const courses = courseRepo.getUserCourseNames(userId)
        const formattedCourses = courses.map(c => ({ courseId: c.course_id, name: c.name }));
        console.log('Received courses fetch request:', userId);
        res.status(200).json({ success: true, courses: formattedCourses });
    } catch (error) {
        console.error('Error getting courses:', error);
        res.status(500).json({ success: false, message: 'Failed to get courses' });
    }
});

// VP selected courses (list)
router.get('/users/:userId/vpSelectedCourses', authenticateToken, authorizeUser, (req, res) => {
    const { userId } = req.params;
    try {
        const courses = vpRepo.getUserVpSelectedCourses(userId)
        res.status(200).json({ success: true, courses });
    } catch (error) {
        console.error('Error getting courses:', error);
        res.status(500).json({ success: false, message: 'Failed to get courses' });
    }
});

// Add VP selected course
router.post('/users/:userId/vpSelectedCourses', authenticateToken, authorizeUser, (req, res) => {
    const { userId } = req.params;
    let { courseName } = req.body;
    courseName = (courseName || "").trim();
    if (!courseName) {
        return res.status(400).json({ success: false, message: 'courseName is required' });
    }
    try {
        vpRepo.insertUserVpSelectedCourse(userId, courseName);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error inserting course:', error);
        res.status(500).json({ success: false, message: 'Failed to insert course' });
    }
});

// Delete VP selected course
router.delete('/users/:userId/vpSelectedCourses/:courseName', authenticateToken, authorizeUser, (req, res) => {
    const { userId } = req.params;
    const courseName = decodeURIComponent(req.params.courseName || "").trim();
    if (!courseName) {
        return res.status(400).json({ success: false, message: 'courseName is required' });
    }

    console.log('Received course deletion:', userId, courseName);

    try {
        vpRepo.deleteUserVpSelectedCourse(userId, courseName);
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
        await updateAllSpUserData(1, 6078);
        res.status(200).json({ success: true, message: 'Update triggered successfully' });
    } catch (error) {
        console.error('Error triggering update:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger update' });
    }
});

// dev notifications
router.get('/sendNotification', (req, res) => {
    const uri = buildDeeplink("revealmark/1");
    sendNotificationToUser(1, "test", "reveal deeplink server: mark reveal 1", { deepLink: uri, channel_id: CHANNEL_NAMES.CHANNEL_GRADES })
        .then(() => res.status(200).json({ success: true, message: 'Notification sent successfully' }))
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

router.get('/sendNotification2/:courseName', (req, res) => {
    const courseName = decodeURIComponent(req.params.courseName);
    const uri = buildDeeplink("vpScreen", { course: courseName });
    sendNotificationToUser(1, `${uri}`, `open vp mit deepLink, course: ${courseName}`, { deepLink: uri, channel_id: CHANNEL_NAMES.CHANNEL_VP_UPDATES })
        .then(() => res.status(200).json({ success: true, message: 'Notification sent successfully' }))
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

router.get('/sendNotification3', (req, res) => {
    const uri = buildDeeplink("settings");
    sendNotificationToUser(1, "deeplink gesendet", "settings", { deepLink: uri, channel_id: CHANNEL_NAMES.CHANNEL_OTHER })
        .then(() => res.status(200).json({ success: true, message: 'Notification sent successfully' }))
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

router.get('/sendNotification4', (req, res) => {
    const uri = "https://rafaelbeckmann.de/hvkclient/revealmark/15";
    sendNotificationToUser(1, "deeplink mit rafaelbeckmann.de, reveal mark", "link", { deepLink: uri, channel_id: CHANNEL_NAMES.CHANNEL_OTHER })
        .then(() => res.status(200).json({ success: true, message: 'Notification sent successfully' }))
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

router.get('/ai', async (req, res) => {
    //const prompt = decodeURIComponent(req.params.prompt);

    console.log("ai test")

    const vpData = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html`);
    const vpString = vpData.rawPage;

    const oldSummary = "Technik-AG Vorbereitungstreffen für interessierte Schülerinnen und Schüler 7./8. Stunde Kleist Forum"

    const systemPrompt = `Du bist ein deutscher Extraktions-Assistent für den Vertretungsplan einer Schule. Oben stehen, falls es welche gibt, besondere Infos. Sei Intelligent und suche diese raus. Die 3 Tabellen für fehlende Lehrer, Klassen und Räume sind normal und zählen nicht dazu. Ebenfalls gehören die normalen max. 2 Tabellen für Vertretungen und Ersatzräume ebenfalls nicht dazu. Nur besondere Infos. Antworte nur damit, mit nichts anderem. Benutz alle normale deutsche Zeichen, also auch ß,ü etc, falls angemessen. Eins ist der normale text, und falls es lang ist, kannst du auch in summary eine kürzere version schreiben, welche ungefähr max. 6 Wörter sein soll. der normale soll aber original (aber sinnvoll) bleiben.
    Wenn die alte Zusammenfassung noch korrekt ist, setze es null.
    Gib ausschließlich gültiges JSON zurück (kein Text, keine Erklärungen).
    Schema:
    {
    "text": string | null,
    "summary": string | null,
    }
    
    `;

    const prompt = `Vertretungsplan:\n${vpString}\n\nAlte Zusammenfassung: ${oldSummary}`


    console.log("prompt: " + prompt);

    let response;
    try {
        response = await aiTest(systemPrompt, prompt)
    } catch (error) {
        console.error('Error sending AI test prompt:', error);
        res.status(500).json({ success: false, message: `Failed to send AI test: ${error}`});
    }
    res.status(200).json({success: true, message: response});

});

router.get('/featureFlags', async (req, res) => {
    res.status(200).json({success: true, featureFlags: {"isFabVisible": true}});
});


// dev vp update
router.get('/vpUpdate', async (req, res) => {
    try {
        const data = await vpCheckForDifferences(1);
        await vpCheckForDifferences(2);
        res.status(200).json({ success: true, message: data });
    } catch (error) {
        console.error('Error vp update:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger update' });
    }
});

// dev
// TODO: remove
router.get('/vpSubstitutions/:courseName/:day', async (req, res) => {
    const courseName = decodeURIComponent(req.params.courseName);
    const { day } = req.params;
    if (day !== "today" && day !== "tomorrow") {
        return res.status(400).json({ success: false, message: 'Invalid day' });
    }
    const dayInt = day === "today" ? 1 : 2;
    try {
        const vpDate = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayInt}/vp.html`);
        const data = vpRepo.listSubstitutions(courseName, day, vpDate.websiteDate);
        res.status(200).json({ success: true, substitutions: data });
    } catch (error) {
        console.error('Error fetching substitutions:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger update' });
    }
});

// TODO: das hier gut machen, ist noch größtenteils kopiert von oben
router.get('/vpSubstitutions/:courseName', async (req, res) => {
    const courseName = decodeURIComponent(req.params.courseName);

    console.log('Received trigger update for course:', courseName);

    try {
        const vals = [];
        for (let dayInt = 1; dayInt <= 2; dayInt++) {
            const vpDate = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayInt}/vp.html`);
            const day = dayInt === 1 ? "today" : "tomorrow";
            const data = vpRepo.listSubstitutions(courseName, day, vpDate.websiteDate);
            vals.push(data);
        }
        res.status(200).json({ success: true, substitutions: vals });
    } catch (error) {
        console.error('Error fetching substitutions:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger update' });
    }
});

router.get('/vpSubstitutions', async (req, res) => {
    // TODO: query parameter lists macht man anders oder?
    const { courses } = req.query;
    if (!courses) {
        return res.status(400).json({ success: false, message: 'Courses query parameter is required' });
    }
    const courseNames = courses.split(',');
    console.log('Received substitution request for courses:', courseNames);

    try {
        const allSubstitutions = {};
        for (const courseName of courseNames) {
            allSubstitutions[courseName] = { today: [], tomorrow: [] };
        }
        for (let dayInt = 1; dayInt <= 2; dayInt++) {
            const vpDate = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayInt}/vp.html`);
            const day = dayInt === 1 ? "today" : "tomorrow";
            const substitutions = vpRepo.listSubstitutionsForCourses(courseNames, day, vpDate.websiteDate)
            substitutions.forEach(sub => {
                if (allSubstitutions[sub.course]) {
                    allSubstitutions[sub.course][day].push(sub);
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

router.get('/courseSearch', (req, res) => {
    const { courseName } = req.query;
    if (!courseName) return res.status(400).json({ success: false, message: 'courseName required' });
    const result = vpRepo.courseSearch(courseName);
    res.status(200).json({ success: true, courses: result });
});

router.get("/rick", (req, res) => {
    res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

export default router;
