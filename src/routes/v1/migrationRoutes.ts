import {Router} from "express";
import {getDevV1} from "../../controllers/migrationController.js";

const router = Router();

router.get("/dev-v1", getDevV1);

export default router;