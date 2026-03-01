targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources (used by Functions, Storage, etc.)')
param location string

@description('Location for Static Web App (limited region availability)')
param staticWebAppLocation string = 'eastasia'

// ── External service connection strings (provided via azd env set) ──────────

@secure()
@description('Azure SignalR Service connection string')
param azureSignalRConnectionString string

@description('Azure Document Intelligence endpoint')
param azureDocumentIntelligenceEndpoint string

@secure()
@description('Azure Document Intelligence key')
param azureDocumentIntelligenceKey string

@description('Azure Cognitive Services (Content Understanding) endpoint')
param cognitiveServicesEndpoint string

@secure()
@description('Azure Cognitive Services key')
param cognitiveServicesKey string

@description('Azure OpenAI endpoint (APIM gateway)')
param azureOpenAIEndpoint string

@secure()
@description('Azure OpenAI key (APIM subscription key)')
param azureOpenAIKey string

@description('Azure OpenAI chat deployment name')
param azureOpenAIChatDeploymentName string = 'gpt-4.1'

@description('Azure OpenAI reasoning deployment name')
param azureOpenAIReasoningDeploymentName string = 'o3-mini'

@description('Azure OpenAI API version')
param azureOpenAIApiVersion string = '2025-01-01-preview'

@description('Durable Functions task hub name')
param taskHubName string = 'IDPWorkflow'

@description('Log Analytics workspace retention in days')
param logAnalyticsRetentionDays int = 30

@description('Storage account SKU name')
param storageAccountSkuName string = 'Standard_LRS'

@description('Maximum number of function app instances')
param functionAppMaxInstances int = 100

@description('Memory in MB per function app instance')
param functionAppInstanceMemoryMB int = 2048

// ── Tags ────────────────────────────────────────────────────────────────────

var tags = {
  'azd-env-name': environmentName
}

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

// ── Resource Group ──────────────────────────────────────────────────────────

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// ── Module: Core infrastructure ─────────────────────────────────────────────

module core 'core.bicep' = {
  name: 'core'
  scope: rg
  params: {
    location: location
    staticWebAppLocation: staticWebAppLocation
    resourceToken: resourceToken
    tags: tags
    azureSignalRConnectionString: azureSignalRConnectionString
    azureDocumentIntelligenceEndpoint: azureDocumentIntelligenceEndpoint
    azureDocumentIntelligenceKey: azureDocumentIntelligenceKey
    cognitiveServicesEndpoint: cognitiveServicesEndpoint
    cognitiveServicesKey: cognitiveServicesKey
    azureOpenAIEndpoint: azureOpenAIEndpoint
    azureOpenAIKey: azureOpenAIKey
    azureOpenAIChatDeploymentName: azureOpenAIChatDeploymentName
    azureOpenAIReasoningDeploymentName: azureOpenAIReasoningDeploymentName
    azureOpenAIApiVersion: azureOpenAIApiVersion
    taskHubName: taskHubName
    logAnalyticsRetentionDays: logAnalyticsRetentionDays
    storageAccountSkuName: storageAccountSkuName
    functionAppMaxInstances: functionAppMaxInstances
    functionAppInstanceMemoryMB: functionAppInstanceMemoryMB
  }
}

// ── Outputs (consumed by azd) ───────────────────────────────────────────────

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name

// azd convention: SERVICE_<name>_RESOURCE_ID for deployment targets
output SERVICE_API_RESOURCE_ID string = core.outputs.functionAppId
output SERVICE_API_NAME string = core.outputs.functionAppName
output SERVICE_FRONTEND_RESOURCE_ID string = core.outputs.staticWebAppId
output SERVICE_FRONTEND_NAME string = core.outputs.staticWebAppName

output STATIC_WEB_APP_URL string = core.outputs.staticWebAppUrl
output FUNCTION_APP_URL string = core.outputs.functionAppUrl
output NEXT_PUBLIC_API_BASE_URL string = core.outputs.functionAppUrl
output AZURE_STORAGE_ACCOUNT_NAME string = core.outputs.storageAccountName
output DURABLE_TASK_SCHEDULER_ENDPOINT string = core.outputs.durableTaskSchedulerEndpoint
