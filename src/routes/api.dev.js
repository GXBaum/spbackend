import express from "express";
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import {sendNotificationToUser} from "../services/notifications.js";
import {updateAllSpUserData} from "../services/updateAllSpUserData.js";
import {scrapeVpData} from "../services/scrapeVp.js";
import {vpCheckForDifferences} from "../services/vpCheckForDifferences.js";
import {
    authenticateToken,
    authorizeUser,
    createAccessToken,
    createRefreshToken,
    login,
    refreshToken,
    verifyPassword
} from '../auth.js';
import {buildDeeplink} from "../utils/deepLinkBuilder.js";
import {CHANNEL_NAMES} from "../config/constants.js";
import {aiService} from "../services/aiService.js";
import {createDefaultVpRepository} from "../db/repositories/vpRepository.js";
import {createDefaultUserRepository} from "../db/repositories/userRepository.js";
import {createDefaultAuthRepository} from "../db/repositories/authRepository.js";
import {createDefaultMarkRepository} from "../db/repositories/marksRepository.js";
import {createDefaultCourseRepository} from "../db/repositories/courseRepository.js";
import {createDefaultNotificationsRepository} from "../db/repositories/notificationsRepository.js";
import {createDefaultMessageRepository} from "../db/repositories/messageRepository.js";
import {readFileSync} from "fs";
import path from "path";
import {getLoginCookies, initMessageAccess} from "../services/auth.js";
import {reply} from "../services/messagesOldReinkopiert.js";

const vpRepo = createDefaultVpRepository();
const userRepo = createDefaultUserRepository();
const authRepo = createDefaultAuthRepository();
const markRepo = createDefaultMarkRepository();
const courseRepo = createDefaultCourseRepository();
const notificationsRepo = createDefaultNotificationsRepository();
const messageRepo = createDefaultMessageRepository()

const router = express.Router();

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 2000,
    delayMs: (hits) => (hits - 100) * 100,
    keyGenerator: (req) => req.ip,
    // onLimitReached was removed https://express-rate-limit.github.io/WRN_ERL_DEPRECATED_ON_LIMIT_REACHED
    handler: (request, response, next, options) => {
        if (request.rateLimit.used === request.rateLimit.limit + 1) {
            console.log(`Speed limit reached for IP: ${req.ip} at ${new Date().toISOString()}`);
        }
        response.status(options.statusCode).send(options.message)
    },
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    // onLimitReached was removed
    handler: (request, response, next, options) => {
        if (request.rateLimit.used === request.rateLimit.limit + 1) {
            console.log(`Rate limit reached for IP: ${req.ip} at ${new Date().toISOString()}`);
        }
        response.status(options.statusCode).send(options.message)
    },
});

router.use(speedLimiter);
router.use(generalLimiter);

// User registration
router.post('/users', async (req, res) => {
    const { isNotificationEnabled  } = req.body;

    console.log('Received user creation request');

    if (isNotificationEnabled === undefined) {
        return res.status(400).json({ success: false, message: 'isNotificationEnabled are required' });
    }
    try {
        const userId = userRepo.insertUser(isNotificationEnabled);

        const refreshToken = createRefreshToken();
        const accessToken = createAccessToken(userId);

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 90); // 90-day expiry

        authRepo.storeRefreshToken(userId, refreshToken, expiryDate.toISOString());


        console.log('User created successfully');
        try {
            await sendNotificationToUser(1, "account erstellt", userId,{ "channel_id": CHANNEL_NAMES.CHANNEL_OTHER });
        } catch (err){
            console.log("couldn't send notification: " + err);
        }
        res.status(201).json({ success: true, accessToken, refreshToken, userId: userId });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
    }
});

router.delete('/users/:username', verifyPassword, async (req, res) => {
    const { username } = req.params;
    const { password } = req.body;

    try {
        console.log("Received user DELETE request");
        sendNotificationToUser(1, "account löschung angefragt", username, { "channel_id": CHANNEL_NAMES.CHANNEL_OTHER }).catch(()=>{});

        const deleted = userRepo.deleteUserWithSpCredentials(username, password);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        sendNotificationToUser(1, "account gelöscht", username, { "channel_id": CHANNEL_NAMES.CHANNEL_OTHER }).catch(()=>{});
        // TODO: Optionally revoke tokens
        res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Failed to delete account' });
    }
});

router.post('/auth/login', login);
router.post('/auth/token', refreshToken);

router.put('/users/:userId/notification-token', authenticateToken, authorizeUser, async (req, res) => {
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
        sendNotificationToUser(1, "user Noten angefragt", userId, { "channel_id": CHANNEL_NAMES.CHANNEL_OTHER }).catch(()=>{});
    } catch (error) {
        console.error('Error getting marks:', error);
        res.status(500).json({ success: false, message: 'Failed to get marks' });
    }
});

router.get('/migrations/dev-v1/:userId', (req, res) => {
    const { userId } = req.params;
    const { refreshToken } = req.query;

    console.log("here:" + userId)
    console.log(`user ${userId} is migrating...`)

    const tokenVerification = authRepo.getRefreshToken(refreshToken)
    if (tokenVerification == null) {
        console.log("user verification failed, no refresh token match")

        return res.sendStatus(403);
    }

    const tokenUserId = tokenVerification.user_id;
    console.log("userId from token: " + tokenUserId);


    if (userId != tokenUserId) {
        console.log("user doesnt match")
        res.sendStatus(403)
    }

    try {
        const user = userRepo.getUserById(userId)
        const courses = vpRepo.getUserVpSelectedCoursesRaw(userId)
        const notificationTokens = notificationsRepo.getUserNotificationTokensRaw(userId)
        const refreshTokens = authRepo.getAllRefreshTokensForUser(userId)

        const response = {
            user: user,
            courses: courses,
            notificationTokens: notificationTokens,
            refreshTokens: refreshTokens
        }

        userRepo.updateUserNotifications(userId, false) // turn off notifications, as new server will now do that

        console.log(response)

        res.status(200).json({ success: true, data: response });
    } catch (error) {
        console.error('Error getting migration data:', error);
        res.status(500).json({ success: false, message: 'Failed to get migration data' });
    }
});


// Marks (by course)
router.get('/users/:userId/:courseId/marks', authenticateToken, authorizeUser, (req, res) => {
    const { userId, courseId } = req.params;
    try {
        const marks = markRepo.getUserMarksForCourse(userId, courseId)
            // quick fix for json scheme
            .map(sub => ({
                ...sub,
                isDeleted: Boolean(Number(sub.is_deleted)),
                is_deleted: undefined,
            }));
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

router.get('/users/:userId/courses/:courseId', authenticateToken, authorizeUser, (req, res) => {
    const { userId, courseId } = req.params;
    try {
        const courses = courseRepo.getUserCourseById(courseId)
        const course = courses [0]
        const formattedCourse = { courseId: course.id, name: course.name }
        console.log('Received courses fetch request:', userId);
        res.status(200).json({ success: true, course: formattedCourse });
    } catch (error) {
        console.error('Error getting courses:', error);
        res.status(500).json({ success: false, message: 'Failed to get courses' });
    }
});



// Chats
router.get('/users/:userId/chats', authenticateToken, authorizeUser, (req, res) => {
    const { userId } = req.params

    try {
        const result = messageRepo.getUserChats(userId).map(chat => ({
            ...chat,
            chatId: chat.chat_id,
            chat_id: undefined,
            id: undefined
        }));

        res.status(200).json({ success: true, chats: result})
    } catch {

    }
});

// TODO security vulnerability ? userId not used. but chatid is so long should not matter.
router.get('/users/:userId/chats/:chatId/messages', authenticateToken, authorizeUser, (req, res) => {
    const { userId, chatId } = req.params

    try {
        const result = messageRepo.getChatMessages(chatId).map( message => ({
            ...message,
            messageId: message.id,
            id: undefined,
            chatId: message.chat_id,
            chat_id: undefined
        }))

        res.status(200).json({ success: true, messages: result})
    } catch {

    }
});

router.post('/users/:userId/chats/:chatId/messages', authenticateToken, authorizeUser, async (req, res) => {
    const {userId, chatId} = req.params;
    let {message} = req.body;
    message = (message || "").trim();

    if (!message) {
        return res.status(400).json({success: false, message: 'message is required'});
    }

    try {
        const user = userRepo.getUserMerged(userId);
        console.log(user);
        if (!user) {
            console.error(`User not found for ID: ${userId}`);
            return;
        }
        const spUsername = user.sp_username;
        const spPassword = user.sp_password;


        const loginCookies = await getLoginCookies(spUsername, spPassword);
        const aesKeyToken = await initMessageAccess(loginCookies)

        const result = await reply(
            message,
            chatId,
            aesKeyToken,
            loginCookies
        )

        console.log(result)


        res.status(200).json({success: true});
    } catch (error) {
        res.status(500).json({success: false, message: 'Failed to send reply'});
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

router.get('/sendNotification5', (req, res) => {
    const uri = buildDeeplink("revealmark/15");
    sendNotificationToUser(1, `Hallo ${Math.random()*10}`, "schreib mir", { deepLink: uri, channel_id: CHANNEL_NAMES.CHANNEL_VP_UPDATES, "notificationId": 1 })
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
        response = await aiService(systemPrompt, prompt)
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


// TODO: das hier gut machen, ist noch größtenteils kopiert von oben
router.get('/vpSubstitutions/:courseName', async (req, res) => {
    const courseName = decodeURIComponent(req.params.courseName);

    console.log('Received trigger update for course:', courseName);

    try {
        const vals = [];
        for (let dayInt = 1; dayInt <= 2; dayInt++) {
            const vpDate = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayInt}/vp.html`);
            const day = dayInt === 1 ? "today" : "tomorrow";
            const data = vpRepo.listAllSubstitutions(courseName, day, vpDate.websiteDate);

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
            allSubstitutions[courseName] = { today: [], tomorrow: [], roomsToday: [], roomsTomorrow: [] };
        }
        for (let dayInt = 1; dayInt <= 2; dayInt++) {
            const vpDate = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayInt}/vp.html`);
            const day = dayInt === 1 ? "today" : "tomorrow";
            const substitutions = vpRepo.listAllSubstitutionsForCourses(courseNames, day, vpDate.websiteDate)
                // quick fix for json scheme
                .map(sub => ({
                    ...sub,
                    isDeleted: Boolean(Number(sub.is_deleted)),
                    is_deleted: undefined,
                }));
            substitutions.forEach(sub => {
                if (allSubstitutions[sub.course]) {
                    allSubstitutions[sub.course][day].push(sub);
                }
            });

            // TODO: improve this code, this is largely duplicated
            const roomDay = dayInt === 1 ? "roomsToday" : "roomsTomorrow";
            const rooms = vpRepo.listAllDifferentRoomsForCourses(courseNames, day, vpDate.websiteDate)
                .map(sub => ({
                    ...sub,
                    isDeleted: Boolean(Number(sub.is_deleted)),
                    is_deleted: undefined,
                }));
            rooms.forEach(sub => {
                if (allSubstitutions[sub.course]) {
                    allSubstitutions[sub.course][roomDay].push(sub);
                }
            });

        }
        res.status(200).json({
            success: true,
            substitutions: allSubstitutions,
            
        });
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

router.get('/vp/info', (req, res) => {
    const result = vpRepo.getLatestVpInfoBothDays();
    console.log("vp info result: " + result);
    res.status(200).json({ success: true, info: result });
});





router.get("/rick", (req, res) => {
    res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});


// TODO: necessary Play Store links, move somewhere else
router.get("/deleteAccount", (req, res) => {
    const html = readFileSync(path.join(process.cwd(), 'src/routes/deleteAccount.html'), "utf8");
    res.send(html);
});
router.get("/Datenschutzerkl%C3%A4rung", (req, res) => {
    const html = readFileSync(path.join(process.cwd(), 'src/routes/Datenschutzerklärung.html'), "utf8");
    res.send(html);
});


export default router;
