import { loadLocalEnv } from "./load-env.js";
import { fetchFormattedMarkdown } from "./agent.js";

loadLocalEnv();

const baseUrl =
  process.env.DOZUKI_BASE_URL || "https://gp-sandbox.dozuki.com";
const guideid = Number(process.env.DOZUKI_GUIDE_ID || "1");

const md = await fetchFormattedMarkdown({ baseUrl, guideid });
process.stdout.write(md + "\n");
