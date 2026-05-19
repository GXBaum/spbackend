import {Router} from "express";
import {getSubstitutions, postSubstitutions} from "../../controllers/substitutionsController.js";

const router = Router();

router.get("/substitutions", getSubstitutions);
router.post("/substitutions", postSubstitutions);

export default router;