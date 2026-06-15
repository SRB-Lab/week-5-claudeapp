import OpenAI from 'openai'

let client: OpenAI | null = null

export function getAzureClient(): OpenAI {
  if (client) return client

  const apiKey = process.env.AZURE_API_KEY
  const baseURL = process.env.AZURE_AGENT_ENDPOINT

  if (!apiKey || !baseURL) {
    throw new Error('Missing Azure env vars: AZURE_API_KEY, AZURE_AGENT_ENDPOINT')
  }

  client = new OpenAI({
    baseURL,
    apiKey,
    defaultHeaders: { 'api-key': apiKey },
    defaultQuery: { 'api-version': '2025-05-15-preview' },
  })

  return client
}
