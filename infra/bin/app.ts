#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TrackerStack } from "../lib/tracker-stack";

const app = new cdk.App();
const ctx = (k: string) => app.node.tryGetContext(k);
const appUrls = ctx("appUrls");

new TrackerStack(app, "ExerciseTracker", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
  vercelTeamSlug: ctx("vercelTeamSlug"),
  vercelProject: ctx("vercelProject"),
  appUrls: typeof appUrls === "string" ? JSON.parse(appUrls) : appUrls,
  selfSignUp: String(ctx("selfSignUp")) === "true",
});
