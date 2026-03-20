import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generateRouter from "./generate";
import authRouter from "./auth";
import stripeRouter from "./stripe";
import deployRouter from "./deploy";
import styleRouter from "./style";
import chatRouter from "./chat";
import autoBusinessRouter from "./auto-business";
import seoRouter from "./seo";
import githubRouter from "./github";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(generateRouter);
router.use(stripeRouter);
router.use(deployRouter);
router.use(styleRouter);
router.use(chatRouter);
router.use(autoBusinessRouter);
router.use(seoRouter);
router.use(githubRouter);

export default router;
