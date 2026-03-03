@description('Location for all resources')
param location string

@description('Location for Static Web App')
param staticWebAppLocation string

@description('Unique token for resource naming')
param resourceToken string

@description('Tags for all resources')
param tags object

// ── External service params ─────────────────────────────────────────────────

@secure()
param azureSignalRConnectionString string
param azureDocumentIntelligenceEndpoint string
@secure()
param azureDocumentIntelligenceKey string
param cognitiveServicesEndpoint string
@secure()
param cognitiveServicesKey string
param azureOpenAIEndpoint string
@secure()
param azureOpenAIKey string
param azureOpenAIChatDeploymentName string
param azureOpenAIReasoningDeploymentName string
param azureOpenAIApiVersion string
param taskHubName string

@description('Log Analytics workspace retention in days')
param logAnalyticsRetentionDays int = 30

@description('Storage account SKU name')
param storageAccountSkuName string = 'Standard_LRS'

@description('Maximum number of function app instances')
param functionAppMaxInstances int = 100

@description('Memory in MB per function app instance')
param functionAppInstanceMemoryMB int = 2048

@description('Principal ID of the deploying user (auto-populated by azd)')
param principalId string = ''

// ── Log Analytics Workspace ─────────────────────────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logAnalyticsRetentionDays
  }
}

// ── Application Insights ────────────────────────────────────────────────────

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${resourceToken}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ── Storage Account (for Azure Functions) ───────────────────────────────────

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stg${resourceToken}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: storageAccountSkuName
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: false
    // publicNetworkAccess is controlled by NSP association.
    // Starts open so postdeploy can upload documents, then NSP is tightened to Enforced.
  }
}

// ── Blob container for Flex Consumption deployment packages ─────────────────

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'deploymentpackage'
}

resource documentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'documents'
}

// ── Network Security Perimeter (restrict storage public access) ─────────────

resource networkSecurityPerimeter 'Microsoft.Network/networkSecurityPerimeters@2023-07-01-preview' = {
  name: 'nsp-${resourceToken}'
  location: location
  tags: tags
  properties: {}
}

resource nspProfile 'Microsoft.Network/networkSecurityPerimeters/profiles@2023-07-01-preview' = {
  parent: networkSecurityPerimeter
  name: 'profile-storage'
  location: location
  properties: {}
}

resource nspInboundRule 'Microsoft.Network/networkSecurityPerimeters/profiles/accessRules@2023-07-01-preview' = {
  parent: nspProfile
  name: 'allow-subscription-inbound'
  location: location
  properties: {
    direction: 'Inbound'
    subscriptions: [
      {
        id: subscription().id
      }
    ]
  }
}

resource nspStorageAssociation 'Microsoft.Network/networkSecurityPerimeters/resourceAssociations@2023-07-01-preview' = {
  parent: networkSecurityPerimeter
  name: 'assoc-storage'
  location: location
  properties: {
    privateLinkResource: {
      id: storageAccount.id
    }
    profile: {
      id: nspProfile.id
    }
    // Start in Learning mode so postdeploy hooks can upload documents.
    // postdeploy.sh switches this to 'Enforced' after upload completes.
    accessMode: 'Learning'
  }
}

// ── RBAC: Function App → Storage (identity-based access) ────────────────────

var storageRoleDefinitionIds = [
  'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'  // Storage Blob Data Owner
  '17d1049b-9a84-46fb-8f53-869881c3d3ab'  // Storage Account Contributor
  '974c5e8b-45b9-4653-ba55-5f855dd0fb88'  // Storage Queue Data Contributor
  '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'  // Storage Table Data Contributor
  '69566ab7-960f-475b-8e7c-b3118f30c6bd'  // Storage File Data Privileged Contributor
]

resource storageRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for roleId in storageRoleDefinitionIds: {
  name: guid(storageAccount.id, functionApp.id, roleId)
  scope: storageAccount
  properties: {
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
  }
}]

// ── RBAC: Deploying user → Storage (needed for azd deploy with shared key disabled) ─
var deployerStorageRoleIds = [
  'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'  // Storage Blob Data Owner
  '17d1049b-9a84-46fb-8f53-869881c3d3ab'  // Storage Account Contributor
]

resource deployerStorageRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for roleId in deployerStorageRoleIds: if (!empty(principalId)) {
  name: guid(storageAccount.id, principalId, roleId)
  scope: storageAccount
  properties: {
    principalId: principalId
    principalType: 'User'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
  }
}]

// ── User-Assigned Managed Identity (for DTS access) ────────────────────────

resource dtsIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-dts-${resourceToken}'
  location: location
  tags: tags
}

// ── Durable Task Scheduler ───────────────────────────────────────────────────

resource durableTaskScheduler 'Microsoft.DurableTask/schedulers@2025-04-01-preview' = {
  name: 'dts-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'Dedicated'
      capacity: 1
    }
    ipAllowlist: [
      '0.0.0.0/0'
    ]
  }
}

resource durableTaskHub 'Microsoft.DurableTask/schedulers/taskHubs@2025-04-01-preview' = {
  parent: durableTaskScheduler
  name: taskHubName
  properties: {}
}

// ── RBAC: Function App → Durable Task Scheduler ────────────────────────────

resource durableTaskDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(durableTaskScheduler.id, dtsIdentity.id, '0ad04412-c4d5-4796-b79c-f76d14c8d402')
  scope: durableTaskScheduler
  properties: {
    principalId: dtsIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0ad04412-c4d5-4796-b79c-f76d14c8d402')
  }
}

// ── App Service Plan (Flex Consumption) ─────────────────────────────────────

resource functionPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'plan-${resourceToken}'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

// ── Function App ────────────────────────────────────────────────────────────

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: 'func-${resourceToken}'
  location: location
  tags: union(tags, {
    'azd-service-name': 'api'
  })
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${dtsIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccount.properties.primaryEndpoints.blob}deploymentpackage'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: functionAppMaxInstances
        instanceMemoryMB: functionAppInstanceMemoryMB
      }
      runtime: {
        name: 'python'
        version: '3.11'
      }
    }
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: storageAccount.name }
        { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: storageAccount.name }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'TASKHUB_NAME', value: taskHubName }
        { name: 'DurableTaskSchedulerConnection', value: 'Endpoint=${durableTaskScheduler.properties.endpoint};Authentication=ManagedIdentity;ClientId=${dtsIdentity.properties.clientId}' }
        { name: 'AzureSignalRConnectionString', value: azureSignalRConnectionString }
        { name: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', value: azureDocumentIntelligenceEndpoint }
        { name: 'AZURE_DOCUMENT_INTELLIGENCE_KEY', value: azureDocumentIntelligenceKey }
        { name: 'COGNITIVE_SERVICES_ENDPOINT', value: cognitiveServicesEndpoint }
        { name: 'COGNITIVE_SERVICES_KEY', value: cognitiveServicesKey }
        { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAIEndpoint }
        { name: 'AZURE_OPENAI_KEY', value: azureOpenAIKey }
        { name: 'AZURE_OPENAI_CHAT_DEPLOYMENT_NAME', value: azureOpenAIChatDeploymentName }
        { name: 'AZURE_OPENAI_REASONING_DEPLOYMENT_NAME', value: azureOpenAIReasoningDeploymentName }
        { name: 'AZURE_OPENAI_API_VERSION', value: azureOpenAIApiVersion }
      ]
      cors: {
        allowedOrigins: [
          'https://${staticWebApp.properties.defaultHostname}'
        ]
        supportCredentials: false
      }
    }
  }
}

// ── Static Web App ──────────────────────────────────────────────────────────

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: 'swa-${resourceToken}'
  location: staticWebAppLocation
  tags: union(tags, {
    'azd-service-name': 'frontend'
  })
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// Link Function App as backend API ("Bring your own API")
// All /api/* requests are proxied through SWA to the Function App.
// Note: SignalR negotiate is called directly on the Function App (not through
// this proxy) because SWA intercepts "negotiate" routes with its own auth
// provider which SignalR Service doesn't support.
resource swaLinkedBackend 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: functionApp.id
    region: location
  }
}

// ── Outputs ─────────────────────────────────────────────────────────────────

output functionAppId string = functionApp.id
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}/api'
output staticWebAppId string = staticWebApp.id
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output storageAccountName string = storageAccount.name
output durableTaskSchedulerEndpoint string = durableTaskScheduler.properties.endpoint
