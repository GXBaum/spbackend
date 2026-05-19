import {Router} from "express";
import vpRoutes from "./vpRoutes.js";
import authRoutes from "./authRoutes.js";

const router = Router();

router.use("/vp", vpRoutes)
router.use("/auth", authRoutes)


export default router;