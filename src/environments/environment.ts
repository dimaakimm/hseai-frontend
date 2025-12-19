export const environment = {
  production: false,
  mock: false,
  apiBaseUrl: 'https://platform.stratpro.hse.ru/pu-vleviczkaya-pa-classifier',
  authToken: 'Basic ZGV2ZWxvcGVyOmExNTU2MmViYjNjOTk3NmU=',
  classifierEndpoint: '/classifier/predict',
  aiEndpoint: '/ml/generate',
  request: {
    maxRetries: 2,
    timeoutMs: 15000,
    baseRetryDelayMs: 300,
  },
};
