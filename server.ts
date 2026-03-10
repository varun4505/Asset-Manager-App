import express from "express";
import { createApp } from "./server/app";

const app: express.Application = createApp();

export default app;
