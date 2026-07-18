import {Router} from "express";
import vpRoutes from "./vpRoutes.js";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import {authenticateToken} from "../../middleware/authMiddleware.js";
import spRoutes from "./spRoutes.js";
import migrationRoutes from "./migrationRoutes.js";

const router = Router();

router.use("/vp", vpRoutes);
router.use("/sp", authenticateToken, spRoutes);

router.use("/auth", authRoutes);
router.use("/users/me", authenticateToken, userRoutes);

router.use("/migrations", migrationRoutes);


export default router;