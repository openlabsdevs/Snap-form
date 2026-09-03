import express from "express";
import cors from "cors";
import router from "./routes";
import { csrfGuard } from "./middleware/csrf";
import { errorHandler } from "./middleware/error-handler";

const app: express.Application = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3001",
    credentials: true,
  })
);
app.use(express.json());
app.use(csrfGuard);

app.use(router);

app.use(errorHandler);

export default app;