import type { PluginClientContext } from "@getpaseo/plugin/client";
import { installReply } from "./client/web";

export default function contribute(_client: PluginClientContext) {
  return installReply();
}
