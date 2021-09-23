import * as cdk from '@aws-cdk/core';
import { DynamoDbConstruct } from './dynamodb_stack'
import { GlueConstruct } from './glue_stack'
import { StepFunctionConstruct } from './stepfunction'

const target_environment = 'dev'
const logical_id_prefix = 'DataLakeTypeScript'
const resource_name_prefix = 'abc'

export class AwsCdkPipelinesWorkflowTypescriptStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const dynamo_table: DynamoDbConstruct = new DynamoDbConstruct(this, `${target_environment}${logical_id_prefix}EtlDynamoDb`, {})
    const glue_set_up = new GlueConstruct(this, `${target_environment}${logical_id_prefix}EtlGlue`, {})
    const stepfunction_set_up = new StepFunctionConstruct(this, `${target_environment}${logical_id_prefix}StepFunctionConstruct`,
      {}, dynamo_table.table,glue_set_up.glue_job)
  }
}
