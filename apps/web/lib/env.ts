import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const env = {
  get region() {
    return process.env.APP_AWS_REGION ?? "us-east-1";
  },
  get tableName() {
    return req("TABLE_NAME");
  },
  get awsRoleArn() {
    return process.env.APP_AWS_ROLE_ARN;
  },
  get cognitoIssuer() {
    return req("COGNITO_ISSUER");
  },
  get cognitoClientId() {
    return req("COGNITO_CLIENT_ID");
  },
  get cognitoClientSecret() {
    return req("COGNITO_CLIENT_SECRET");
  },
  get authSecret() {
    return new TextEncoder().encode(req("AUTH_SECRET"));
  },
};
