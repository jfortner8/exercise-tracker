import "server-only";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { env } from "@/lib/env";

let doc: DynamoDBDocumentClient | null = null;

/**
 * On Vercel: exchange the deployment's OIDC token for a short-lived role session.
 * Locally: use the normal AWS CLI credential chain.
 */
export function awsCredentials() {
  const roleArn = env.awsRoleArn;
  return process.env.VERCEL && roleArn ? awsCredentialsProvider({ roleArn }) : fromNodeProviderChain();
}

export function db() {
  if (doc) return doc;
  const raw = new DynamoDBClient({ region: env.region, credentials: awsCredentials() });
  doc = DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: false },
  });
  return doc;
}
