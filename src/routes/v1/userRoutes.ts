import {Router} from "express";
import {postNotificationToken} from "../../controllers/userController.js";

const router = Router();

router.post("/notification-token", postNotificationToken); // TODO: sollte das put oder so sein?

export default router;