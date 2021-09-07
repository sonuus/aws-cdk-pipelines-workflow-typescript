// # Environments (targeted at accounts)
export const DEPLOYMENT = 'Deployment'
export const DEV = 'Dev'
export const TEST = 'Test'
export const PROD = 'Prod'

// # The following export  constants are used to map to parameter/secret paths
export const ENVIRONMENT = 'environment'

// # Manual Inputs
export const GITHUB_REPOSITORY_OWNER_NAME = 'github_repository_owner_name'
export const GITHUB_REPOSITORY_NAME = 'github_repository_name'
export const ACCOUNT_ID = 'account_id'
export const REGION = 'region'
export const LOGICAL_ID_PREFIX = 'logical_id_prefix'
export const RESOURCE_NAME_PREFIX = 'resource_name_prefix'
export const VPC_CIDR = 'vpc_cidr'

// # Secrets Manager Inputs
export const GITHUB_TOKEN = 'github_token'

// # Used in Automated Outputs
export const VPC_ID = 'vpc_id'
export const AVAILABILITY_ZONE_1 = 'availability_zone_1'
export const AVAILABILITY_ZONE_2 = 'availability_zone_2'
export const AVAILABILITY_ZONE_3 = 'availability_zone_3'
export const SUBNET_ID_1 = 'subnet_id_1'
export const SUBNET_ID_2 = 'subnet_id_2'
export const SUBNET_ID_3 = 'subnet_id_3'
export const ROUTE_TABLE_1 = 'route_table_1'
export const ROUTE_TABLE_2 = 'route_table_2'
export const ROUTE_TABLE_3 = 'route_table_3'
export const SHARED_SECURITY_GROUP_ID = 'shared_security_group_id'
export const S3_KMS_KEY = 's3_kms_key'
export const S3_ACCESS_LOG_BUCKET = 's3_access_log_bucket'
export const S3_RAW_BUCKET = 's3_raw_bucket'
export const S3_CONFORMED_BUCKET = 's3_conformed_bucket'
export const S3_PURPOSE_BUILT_BUCKET = 's3_purpose_built_bucket'
export const CROSS_ACCOUNT_DYNAMODB_ROLE = 'cross_account_dynamodb_role'

export const GLUE_CONNECTION_AVAILABILITY_ZONE = 'glue_connection_availability_zone'
export const GLUE_CONNECTION_SUBNET = 'glue_connection_subnet'

export function get_local_configuration(environment: String): any {
    console.log(`Enviroment=${environment}`)
    const local_mapping = {
        DEPLOYMENT: {
            ACCOUNT_ID: '969171869770',
            REGION: 'us-west-1',
            GITHUB_REPOSITORY_OWNER_NAME: 'sonuus',
            GITHUB_REPOSITORY_NAME: 'aws-cdk-pipelines-datalake-etl',
            LOGICAL_ID_PREFIX: 'DataLakeTypeScript',
            RESOURCE_NAME_PREFIX: 'abc',
        },
        DEV: {
            ACCOUNT_ID: '969171869770',
            REGION: 'us-west-1',
            VPC_CIDR: '10.20.0.0/24',
        },
        TEST: {
            ACCOUNT_ID: '969171869770',
            REGION: 'us-west-1',
            VPC_CIDR: '10.10.0.0/24',
        },
        PROD: {
            ACCOUNT_ID: '969171869770',
            REGION: 'us-west-1',
            VPC_CIDR: '10.0.0.0/24',
        },
    }

    switch (environment) {
        case 'DEV':
            return local_mapping.DEV
        case 'TEST':
            return local_mapping.TEST
        default:
            return local_mapping.DEPLOYMENT
    }
}

export function get_environment_configuration(environment: String): any {
    const cloudformation_output_mapping = {
        ENVIRONMENT: environment,
        VPC_ID: `${environment}VpcId`,
        AVAILABILITY_ZONE_1: `${environment}AvailabilityZone1`,
        AVAILABILITY_ZONE_2: `${environment}AvailabilityZone2`,
        AVAILABILITY_ZONE_3: `${environment}AvailabilityZone3`,
        SUBNET_ID_1: `${environment}SubnetId1`,
        SUBNET_ID_2: `${environment}SubnetId2`,
        SUBNET_ID_3: `${environment}SubnetId3`,
        ROUTE_TABLE_1: `${environment}RouteTable1`,
        ROUTE_TABLE_2: `${environment}RouteTable2`,
        ROUTE_TABLE_3: `${environment}RouteTable3`,
        SHARED_SECURITY_GROUP_ID: `${environment}SharedSecurityGroupId`,
        S3_KMS_KEY: `${environment}S3KmsKeyArn`,
        S3_ACCESS_LOG_BUCKET: `${environment}S3AccessLogBucket`,
        S3_RAW_BUCKET: `${environment}RawBucketName`,
        S3_CONFORMED_BUCKET: `${environment}ConformedBucketName`,
        S3_PURPOSE_BUILT_BUCKET: `${environment}PurposeBuiltBucketName`,
        CROSS_ACCOUNT_DYNAMODB_ROLE: `${environment}CrossAccountDynamoDbRoleArn`,
    }

    return { ...cloudformation_output_mapping, ...get_local_configuration(environment) }
}

export function get_all_configurations(): any {
    return {
        DEPLOYMENT: {
            ENVIRONMENT: DEPLOYMENT,
            GITHUB_TOKEN: '/DataLake1/GitHubToken',
            ...get_local_configuration(DEPLOYMENT),
        },
        DEV: get_environment_configuration(DEV),
        TEST: get_environment_configuration(TEST),
        PROD: get_environment_configuration(PROD),
    }
}

export function get_logical_id_prefix(): any {
    
    // const x= get_local_configuration(DEPLOYMENT)[LOGICAL_ID_PREFIX]
    
    // console.log(`x=${x}`)
    return 'DataLakeTypeScript'
}

export function get_resource_name_prefix(): any {
    return 'abc' //get_local_configuration(DEPLOYMENT)[RESOURCE_NAME_PREFIX]
}
