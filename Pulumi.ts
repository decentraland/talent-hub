// import { resolve } from "path";
import * as aws from '@pulumi/aws'
import { all } from "@pulumi/pulumi";
import { env, envTLD } from "dcl-ops-lib/domain";
// import { buildGatsby } from "decentraland-gatsby-deploy/dist/recepies/buildGatsby";
import { createUser } from "decentraland-gatsby-deploy/dist/aws/iam";
// import { variable } from "decentraland-gatsby-deploy/dist/pulumi/env";

export = async function main() {
  if (env !== 'dev') {
    return {}
  }

  const serviceName = 'talent-hub'
  const serviceDomain = `${serviceName}.decentraland.${envTLD}`
  const access = createUser(serviceName)

  const contentBucket = new aws.s3.Bucket(`${serviceName}-website`, {
    acl: "public-read",

    tags: {
      Name: serviceDomain
    },

    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    // requests for "foo/" to "foo/index.html".
    website: {
      indexDocument: "index.html",
      errorDocument: "404.html",
    },

    corsRules: [
      {
        allowedMethods: ["GET", "HEAD"],
        exposeHeaders: ["ETag"],
        allowedOrigins: ["*"],
        maxAgeSeconds: 3600
      }
    ]
  });

  const bucketPolicy = new aws.s3.BucketPolicy(`${serviceName}-bucket-policy`, {
    bucket: contentBucket.bucket,
    policy: all([ access.user.arn, contentBucket.bucket ]).apply(([ user, bucket]): aws.iam.PolicyDocument => ({
      "Version": "2012-10-17",
      "Statement": [
        {
            "Effect": "Allow",
            "Action": [
              "s3:PutObject",
              "s3:GetObject",
              "s3:ListBucket",
              "s3:DeleteObject",
              "s3:PutObjectAcl",
            ],
            "Principal": {
              "AWS": [user]
            },
            "Resource": [
              `arn:aws:s3:::${bucket}`,
              `arn:aws:s3:::${bucket}/*`
            ]
        }
      ]
    }))
  })

  return {
    user: access.user.name,
    bucketName: contentBucket.bucket,
    bucketPolicyName: bucketPolicy.urn,
    WS_ACCESS_KEY_ID: access.creds.id,
    AWS_ACCESS_SECRET: access.creds.secret,
    AWS_REGION: process.env.AWS_REGION,
    AWS_BUCKET_NAME: contentBucket.bucket,
  }
}