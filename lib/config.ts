export const config = {
  uploadThingSecret: process.env.UPLOAD_THING_SECRET,
  uploadThingAppId: process.env.UPLOAD_THING_APP_ID,
  telegram_api_key: process.env.TELEGRAM_API_KEY,
  telegram_app_id: process.env.TELEGRAM_APP_ID,
  groq_api_key: process.env.GROQ_API_KEY,
  redis_uri: process.env.REDIS_URI,
  secret: process.env.SECRET,
  kv_url: process.env.KV_URL,
  kv_rest_api_url: process.env.KV_REST_API_URL,
  kv_rest_api_token: process.env.KV_REST_API_TOKEN,
  kv_rest_api_read_only_token: process.env.KV_REST_API_READ_ONLY_TOKEN,
  whitelist: process.env.WHITELISTED_USERS.split(',')
}