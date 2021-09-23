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
  constructor(scope: cdk.Construct, id: string, props: ConstructorNameProps, job_audit_table: dynamodb.Table, raw_to_conformed_job: glue.CfnJob) {
    super(scope, id);

    const vpc_id = cdk.Fn.importValue(mappings.VPC_ID)
    const shared_security_group_output = cdk.Fn.importValue(mappings.SHARED_SECURITY_GROUP_ID)
    const availability_zones_output_1 = cdk.Fn.importValue(mappings.AVAILABILITY_ZONE_1)
    const subnet_ids_output_1 = cdk.Fn.importValue(mappings.SUBNET_ID_1)
    const route_tables_output_1 = cdk.Fn.importValue(mappings.ROUTE_TABLE_1)
    const conformed_s3_bucket_id = cdk.Fn.importValue(mappings.S3_CONFORMED_BUCKET)


    const vpc = ec2.Vpc.fromVpcAttributes(this, `ImportedVpc`, {
      vpcId: vpc_id,
      availabilityZones: [availability_zones_output_1],
      privateSubnetIds: [subnet_ids_output_1],
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

    const fail_state = new stepfunctions.Fail(this, `${target_environment}${logical_id_prefix}EtlFailedState`, {
      cause: 'Invalid response.',
      error: 'Error'
    })
    const success_state = new stepfunctions.Succeed(this, `${target_environment}${logical_id_prefix}EtlSucceededState`)
    const failure_function_task = new stepfunctions_tasks.LambdaInvoke(this, `${target_environment}${logical_id_prefix}EtlFailureStatusUpdateTask`, {
      lambdaFunction: status_function,
      resultPath: '$.taskresult',
      retryOnServiceExceptions: true,
      outputPath: '$',
      payload: stepfunctions.TaskInput.fromObject({ 'Input.$': '$' })
    })

    const failure_notification_task = new stepfunctions_tasks.SnsPublish(this, `${target_environment}${logical_id_prefix}EtlFailurePublishTask`, {
      topic: notification_topic,
      subject: 'Job Failed',
      message: stepfunctions.TaskInput.fromJsonPathAt('$')
    })

    failure_function_task.next(failure_notification_task)
    failure_notification_task.next(fail_state)

    const success_function_task = new stepfunctions_tasks.LambdaInvoke(this, `${target_environment}${logical_id_prefix}EtlSuccessStatusUpdateTask`, {
      lambdaFunction: status_function,
      resultPath: '$.taskresult',
      retryOnServiceExceptions: true,
      outputPath: '$',
      payload: stepfunctions.TaskInput.fromObject({ 'Input.$': '$' })
    })

    const success_task = new stepfunctions_tasks.SnsPublish(this, `${target_environment}${logical_id_prefix}EtlFailurePublishTask`, {
      topic: notification_topic,
      subject: 'Job Completed',
      message: stepfunctions.TaskInput.fromJsonPathAt('$')
    })

    success_function_task.next(success_task)
    success_task.next(success_state)

    const glue_raw_task = new stepfunctions_tasks.GlueStartJobRun(this, `${target_environment}${logical_id_prefix}GlueRawJobTask`, {
      glueJobName: raw_to_conformed_job.name || '',
      arguments: stepfunctions.TaskInput.fromObject({
        '--target_databasename.$': '$.target_databasename',
        '--target_bucketname.$': '$.target_bucketname',
        '--source_bucketname.$': '$.source_bucketname',
        '--source_key.$': '$.source_key',
        '--base_file_name.$': '$.base_file_name',
        '--p_year.$': '$.p_year',
        '--p_month.$': '$.p_month',
        '--p_day.$': '$.p_day',
        '--table_name.$': '$.table_name'
      }),
      outputPath: '$',
      resultPath: '$.taskresult',
      integrationPattern: stepfunctions.IntegrationPattern.RUN_JOB,
      comment: 'Raw to conformed data load'
    })
    glue_raw_task.addCatch(failure_function_task, { resultPath: '$.taskresult' },)

    const machine_definition = glue_raw_task.next(success_function_task)

    const machine = new stepfunctions.StateMachine(this, `${target_environment.toLocaleLowerCase()}-${resource_name_prefix}-etl-state-machine`, {
      definition: machine_definition
    })

  }
}
