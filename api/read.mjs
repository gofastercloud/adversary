import { createApi } from './app.mjs';
import { dynamoFromEnv } from './lib/store.mjs';
let api;
export const handler = async (event) => { api ||= createApi(await dynamoFromEnv()); return api.read(event); };
