
import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb'

const target_environment = 'DEV'
const logical_id_prefix = 'DataLakeTypeScript'
const resource_name_prefix = 'abc'





export interface ConstructorNameProps {

}

export class DynamoDbConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ConstructorNameProps) {
    super(scope, id);


    const table = new dynamodb.Table(this,
      `${target_environment}${logical_id_prefix}EtlAuditTable`, {
      tableName: `${target_environment.toLowerCase()}-${resource_name_prefix}-etl-job-audit`,
      partitionKey: { name: 'execution_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      encryption: dynamodb.TableEncryption.DEFAULT,
      pointInTimeRecovery: false,
      readCapacity: 5,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      writeCapacity: 5
    })
    
    console.log(table.tableName)


  }
}