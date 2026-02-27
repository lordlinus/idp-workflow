@description('Location for all resources')
param location string

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

// ── Log Analytics Workspace ─────────────────────────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
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
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// ── App Service Plan (Consumption / Flex Consumption) ───────────────────────

resource functionPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-${resourceToken}'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

// ── Function App ────────────────────────────────────────────────────────────

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'func-${resourceToken}'
  location: location
  tags: union(tags, {
    'azd-service-name': 'api'
  })
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    siteConfig: {
      pythonVersion: '3.13'
      linuxFxVersion: 'Python|3.13'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'WEBSITE_CONTENTSHARE', value: 'func-${resourceToken}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'ENABLE_ORYX_BUILD', value: 'true' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'TASKHUB_NAME', value: taskHubName }
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
  location: location
  tags: union(tags, {
    'azd-service-name': 'frontend'
  })
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// Configure SWA app settings (API base URL)
resource swaAppSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    NEXT_PUBLIC_API_BASE_URL: 'https://${functionApp.properties.defaultHostName}/api'
  }
}

// ── Outputs ─────────────────────────────────────────────────────────────────

output functionAppId string = functionApp.id
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}/api'
output staticWebAppId string = staticWebApp.id
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
