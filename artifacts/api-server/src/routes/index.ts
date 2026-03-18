import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import authRouter from "./auth";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(generateRouter);
router.use(stripeRouter);

export default router;
