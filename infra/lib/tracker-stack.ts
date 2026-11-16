import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface TrackerStackProps extends cdk.StackProps {
  vercelTeamSlug: string;
  vercelProject: string;
  /** Origins allowed to use Cognito login, e.g. http://localhost:3000 and the prod URL. */
  appUrls: string[];
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
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const domain = userPool.addDomain("Domain", {
      cognitoDomain: { domainPrefix: `exercise-tracker-${this.account}` },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    const client = userPool.addClient("WebClient", {
      userPoolClientName: "exercise-tracker-web",
      generateSecret: true,
      authFlows: {},
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: props.appUrls.map((u) => `${u}/api/auth/callback`),
        logoutUrls: props.appUrls.map((u) => `${u}/login`),
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      preventUserExistenceErrors: true,
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Managed login (v2) needs a branding resource per client; use Cognito defaults.
    new cognito.CfnManagedLoginBranding(this, "Branding", {
      userPoolId: userPool.userPoolId,
      clientId: client.userPoolClientId,
      useCognitoProvidedValues: true,
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
    new cdk.CfnOutput(this, "CognitoDomain", {
      value: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`,
    });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
  }
}
