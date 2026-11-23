import "server-only";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { rateWindow } from "@et/core/api-input";
import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";

/**
 * Counts a request against `key` in a fixed window and throws 429 past `max`. One small DynamoDB
 * item per key per window (PK "RL#<key>"); `expiresAt` lets the table's TTL clear old ones.
 */
export async function rateLimit(key: string, max: number, windowSec: number) {
  const start = rateWindow(Date.now(), windowSec);
  const res = await db().send(
    new UpdateCommand({
      TableName: env.tableName,
      Key: { PK: `RL#${key}`, SK: String(start) },
      UpdateExpression: "SET entity = :e, expiresAt = :x ADD #n :one",
      ExpressionAttributeNames: { "#n": "count" },
      ExpressionAttributeValues: { ":e": "rateLimit", ":x": start + windowSec * 2, ":one": 1 },
      ReturnValues: "UPDATED_NEW",
    }),
  );
  if (((res.Attributes?.count as number | undefined) ?? 0) > max) {
    throw new ApiError(429, "Too many requests. Wait a minute and try again.", "RATE_LIMITED");
  }
}
