import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as iam from '@aws-cdk/aws-iam'
import * as kms from '@aws-cdk/aws-kms'
import * as glue from '@aws-cdk/aws-glue'
import * as s3_deployment from '@aws-cdk/aws-s3-deployment'
import * as dynamodb from '@aws-cdk/aws-dynamodb'
import * as _lambda from '@aws-cdk/aws-lambda'
import * as s3_notifications from '@aws-cdk/aws-s3-notifications'
import * as stepfunctions from '@aws-cdk/aws-stepfunctions'
import * as stepfunctions_tasks from '@aws-cdk/aws-stepfunctions-tasks'
import * as sns from '@aws-cdk/aws-sns'


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

export class StepFunctionConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ConstructorNameProps,job_audit_table: dynamodb.Table) {
    super(scope, id);

    const vpc_id = cdk.Fn.importValue(mappings.VPC_ID)
    const shared_security_group_output = cdk.Fn.importValue(mappings.SHARED_SECURITY_GROUP_ID)
    const availability_zones_output_1 = cdk.Fn.importValue(mappings.AVAILABILITY_ZONE_1)
    const subnet_ids_output_1 = cdk.Fn.importValue(mappings.SUBNET_ID_1)
    const route_tables_output_1 = cdk.Fn.importValue(mappings.ROUTE_TABLE_1)
    const conformed_s3_bucket_id = cdk.Fn.importValue(mappings.S3_CONFORMED_BUCKET)


    const vpc = ec2.Vpc.fromVpcAttributes(this, `ImportedVpc`, {
      vpcId: vpc_id,
      availabilityZones: [availability_zones_output_1 ],
      privateSubnetIds: [subnet_ids_output_1 ],
      privateSubnetRouteTableIds: [route_tables_output_1]
    })

    const shared_security_group = ec2.SecurityGroup.fromSecurityGroupId(this, `ImportedSecurityGroup`, shared_security_group_output)
    const raw_bucket_name = cdk.Fn.importValue(mappings.S3_RAW_BUCKET)
    const raw_bucket = s3.Bucket.fromBucketName(this, `ImportedRawBucket`, raw_bucket_name)
    const notification_topic = new sns.Topic(this, `${target_environment}${logical_id_prefix}EtlFailedTopic`)
    const status_function = new _lambda.Function(this, `${target_environment}${logical_id_prefix}EtlStatusUpdate`, {
      runtime: _lambda.Runtime.PYTHON_3_8,
      handler: 'lambda_handler.lambda_handler',
      code: _lambda.Code.fromAsset("./lambdas"),
      environment: {
        'DYNAMODB_TABLE_NAME': job_audit_table.tableName,
      },
      securityGroups: [shared_security_group],
      vpc: vpc
    })

    const dynamoDBPolicy = new iam.PolicyStatement({
      actions: ['dynamodb:UpdateItem'],
      resources: [job_audit_table.tableArn],
      effect: iam.Effect.ALLOW
    });

    status_function.addToRolePolicy(dynamoDBPolicy)

  }


}
