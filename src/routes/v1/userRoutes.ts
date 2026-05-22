import {Router} from "express";
import {postNotificationToken} from "../../controllers/userController.js";

const router = Router();

router.post("/notification-token", postNotificationToken);

export default router;