import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface TrackerStackProps extends cdk.StackProps {
  vercelTeamSlug: string;
  vercelProject: string;
  selfSignUp: boolean;
}

export class TrackerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TrackerStackProps) {
    super(scope, id, props);

    // ---------- Data ----------
    const table = new dynamodb.TableV2(this, "Table", {
      tableName: "exercise-tracker",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      // Leaderboards: one PB row per opted-in user per built-in benchmark,
      // queried by benchmark (lbKey = "LB#<catalogKey>") and sorted by score.
      globalSecondaryIndexes: [
        {
          indexName: "leaderboard",
          partitionKey: { name: "lbKey", type: dynamodb.AttributeType.STRING },
          sortKey: { name: "lbScore", type: dynamodb.AttributeType.NUMBER },
        },
      ],
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- Auth ----------
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "exercise-tracker-users",
      selfSignUpEnabled: props.selfSignUp,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: false, mutable: true },
      },
      passwordPolicy: { minLength: 10, requireSymbols: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification: {
        emailSubject: "Your Exercise Tracker code",
        emailBody: "Your Exercise Tracker verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // The app has its own sign-in pages and calls Cognito's API server-side
    // (USER_PASSWORD_AUTH + SECRET_HASH), so no hosted UI / OAuth is needed.
    const client = userPool.addClient("WebClient", {
      userPoolClientName: "exercise-tracker-web",
      generateSecret: true,
      authFlows: { userPassword: true },
      disableOAuth: true,
      preventUserExistenceErrors: true,
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // ---------- Vercel OIDC -> AWS role (no long-lived keys) ----------
    const issuerHost = `oidc.vercel.com/${props.vercelTeamSlug}`;
    const audience = `https://vercel.com/${props.vercelTeamSlug}`;
    const provider = new iam.OidcProviderNative(this, "VercelOidc", {
      url: `https://${issuerHost}`,
      clientIds: [audience],
    });

    const role = new iam.Role(this, "VercelRole", {
      roleName: "exercise-tracker-vercel",
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { [`${issuerHost}:aud`]: audience },
        StringLike: {
          [`${issuerHost}:sub`]: [
            `owner:${props.vercelTeamSlug}:project:${props.vercelProject}:environment:production`,
            `owner:${props.vercelTeamSlug}:project:${props.vercelProject}:environment:preview`,
          ],
        },
      }),
    });
    table.grantReadWriteData(role);

    // ---------- Outputs ----------
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
    new cdk.CfnOutput(this, "VercelRoleArn", { value: role.roleArn });
    new cdk.CfnOutput(this, "CognitoIssuer", {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
    });
    new cdk.CfnOutput(this, "CognitoClientId", { value: client.userPoolClientId });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
  }
}
