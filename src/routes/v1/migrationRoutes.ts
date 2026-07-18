import {Router} from "express";
import {getDevV1} from "../../controllers/migrationController.js";

const router = Router();

router.get("/dev-v1/:userIdOld", getDevV1);

export default router;