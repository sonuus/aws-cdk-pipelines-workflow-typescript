import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as iam from '@aws-cdk/aws-iam'
import * as kms from '@aws-cdk/aws-kms'
import * as glue from '@aws-cdk/aws-glue'
import * as s3_deployment from '@aws-cdk/aws-s3-deployment'
import { S3_ACCESS_LOG_BUCKET, S3_KMS_KEY, SHARED_SECURITY_GROUP_ID, AVAILABILITY_ZONE_1, S3_CONFORMED_BUCKET, S3_PURPOSE_BUILT_BUCKET } from './configuration';

import {
  SUBNET_ID_1,
  get_environment_configuration,
  get_logical_id_prefix,
} from './configuration'

const ACCOUNT_ID = '969171869770'
const target_environment = 'DEV'
const logical_id_prefix = 'DataLakeTypeScript'
const resource_name_prefix = 'abc'

const mappings = get_environment_configuration(target_environment)

export interface ConstructorNameProps {

}

export class GlueConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ConstructorNameProps) {
    super(scope, id);


    const existing_access_logs_bucket_name = cdk.Fn.importValue(mappings.S3_ACCESS_LOG_BUCKET)

    const access_logs_bucket: s3.Bucket = s3.Bucket.fromBucketAttributes(this, `ImportedBucket`, {
      bucketName: existing_access_logs_bucket_name
    }) as s3.Bucket

    const s3_kms_key_parameter = cdk.Fn.importValue(mappings.S3_KMS_KEY)
    const s3_kms_key: kms.Key = kms.Key.fromKeyArn(this, `fromKeyArn`, s3_kms_key_parameter) as kms.Key

    const shared_security_group_parameter = cdk.Fn.importValue(mappings.SHARED_SECURITY_GROUP_ID)

    const glue_connection_subnet = cdk.Fn.importValue(mappings.SUBNET_ID_1)

    const glue_connection_availability_zone = cdk.Fn.importValue(mappings.AVAILABILITY_ZONE_1)

    const conformed_bucket_name = cdk.Fn.importValue(mappings.S3_CONFORMED_BUCKET)
    const conformed_bucket = s3.Bucket.fromBucketName(this, `ImportedConformedBucket`, conformed_bucket_name)

    const purposebuilt_bucket_name = cdk.Fn.importValue(mappings.S3_PURPOSE_BUILT_BUCKET)
    const purposebuilt_bucket = s3.Bucket.fromBucketName(this, `ImportedPurposeBuiltBucket`, purposebuilt_bucket_name)

    const shared_security_group = ec2.SecurityGroup.fromSecurityGroupId(this, `ImportedSecurityGroup`, mappings.SHARED_SECURITY_GROUP_ID)

    const subnet = ec2.Subnet.fromSubnetAttributes(this, `fromSubnetAttributes`, {
      subnetId: glue_connection_subnet,
      availabilityZone: glue_connection_availability_zone
    })

    const glue_scripts_bucket = this.glue_scripts_bucket(target_environment, logical_id_prefix, resource_name_prefix, s3_kms_key, access_logs_bucket)

    const gluePolicyDocument = {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "FirstStatement",
          "Effect": "Allow",
          "Action": ["s3:ListBucketVersions", "s3:ListBucket", "s3:GetBucketNotification", "s3:GetBucketLocation"],
          "Resource": "arn:aws:s3:::*"
        },
        {
          "Sid": "SecondStatement",
          "Effect": "Allow",
          "Action": [
            "s3:ReplicationObject",
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject"
          ],
          "Resource": [
            "arn:aws:s3:::*/*"
          ]
        },
        {
          "Sid": "ThirdStatement",
          "Effect": "Allow",
          "Action": [
            "s3:ListAllMyBuckets"
          ],
          "Resource": [
            "*"
          ]
        }, {
          "Sid": "FourStatement",
          "Effect": "Allow",
          "Action": [
            "kms:*"
          ],
          "Resource": [
            s3_kms_key.keyArn
          ]
        }
      ]
    };
    const customGluePolicyDocument = iam.PolicyDocument.fromJson(gluePolicyDocument);

    const glue_role = new iam.Role(this, `${target_environment.toLowerCase()}-${resource_name_prefix}-RawGlueRole`, {
      roleName: `${target_environment.toLowerCase()}-${resource_name_prefix}-raw-glue-role`,
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com')
    })

    glue_role.attachInlinePolicy(new iam.Policy(this, `customGluePolicyDocument`, {
      document: customGluePolicyDocument
    }))

    glue_role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'))

    const job_conn = new glue.Connection(this, `${target_environment}${logical_id_prefix}RawToConformedWorkflowConnection`, {
      type: glue.ConnectionType.NETWORK,
      connectionName: `${target_environment.toLowerCase()}-${resource_name_prefix}-raw-to-conformed-connection`,
      securityGroups: [shared_security_group],
      subnet: subnet
    })

    const raw_to_conformed_job = new glue.CfnJob(this, `${target_environment}${logical_id_prefix}RawToConformedJob`, {
      role: glue_role.roleName,
      command: {
        name: 'glueetl',
        pythonVersion: `3`,
        scriptLocation: `s3://${glue_scripts_bucket.bucketName}/etl/etl_raw_to_conformed.py`
      },
      name: `${target_environment.toLowerCase()}-${resource_name_prefix}-raw-to-conformed-job`,
      timeout: 30,
      glueVersion: '2.0',
      numberOfWorkers: 5,
      defaultArguments: {
        '--enable-glue-datacatalog': '""',
        '--target_database_name': 'datablog_arg',
        '--target_bucket': conformed_bucket.bucketName,
        '--target_table_name': 'datablog_nyc_raw',
        '--TempDir': `s3://${glue_scripts_bucket.bucketName}temp/etl/raw-to-conformed`,
      },
      executionProperty: {
        maxConcurrentRuns: 10, // Allow parallel runs
      },
      workerType: `G.1X`,
      connections: {
        connections:[job_conn.connectionName]
      }
    })

    //Dynamically upload resources to the script target
    new s3_deployment.BucketDeployment(this, `DeployGlueJobScript`, {
      sources:[s3_deployment.Source.asset('./glue_scripts')],
      destinationBucket: glue_scripts_bucket,
      destinationKeyPrefix: 'etl'
    })
  }

  private glue_scripts_bucket(target_environment: string, logical_id_prefix: string, resource_name_prefix: string, s3_kms_key: kms.Key, access_logs_bucket: s3.Bucket): s3.Bucket {
    const bucket_name = `${target_environment.toLowerCase()}-${resource_name_prefix}-${ACCOUNT_ID}-etl-scripts`
    return new s3.Bucket(this, `${target_environment}${logical_id_prefix}RawGlueScriptsBucket`, {
      bucketName: bucket_name,
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: s3_kms_key,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      serverAccessLogsBucket: access_logs_bucket,
      serverAccessLogsPrefix: bucket_name
    })
  }
}
