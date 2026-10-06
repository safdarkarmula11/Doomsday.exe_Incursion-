/**
 * The ONLY file that talks to the LLM. To change the model or provider, edit here.
 *
 * Two modes, chosen with LLM_MODE in .env:
 *
 *   LLM_MODE="huggingface"   (default, use this on Render)
 *       HF_TOKEN        your Hugging Face token ("Make calls to Inference Providers")
 *       HF_MODEL        model id, e.g. Qwen/Qwen2.5-7B-Instruct
 *       HF_API_URL      optional, default https://router.huggingface.co/v1/chat/completions
 *
 *   LLM_MODE="local"         (for testing on your own machine, no token needed)
 *       LOCAL_LLM_URL   default http://localhost:8080/v1/chat/completions   (llama-server)
 *                       Ollama: http://localhost:11434/v1/chat/completions
 *                       LM Studio: http://localhost:1234/v1/chat/completions
 *       LOCAL_LLM_MODEL default qwen3-8b
 *
 *   Both modes: LLM_TIMEOUT_MS (default 20000 for huggingface, 120000 for local)
 */

const HF_DEFAULT_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct";
const LOCAL_DEFAULT_URL = "http://localhost:8080/v1/chat/completions";
const LOCAL_DEFAULT_MODEL = "qwen3-8b";

/** Read settings from .env every call, so the two modes never mix. */
function getConfig() {
  const mode = (process.env.LLM_MODE || "huggingface").toLowerCase() === "local" ? "local" : "huggingface";

  if (mode === "local") {
    return {
      mode,
      url: process.env.LOCAL_LLM_URL || LOCAL_DEFAULT_URL,
      model: process.env.LOCAL_LLM_MODEL || LOCAL_DEFAULT_MODEL,
      token: null, // a local server needs no token
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 120000, // CPU is slow
    };
  }
  return {
    mode,
    url: process.env.HF_API_URL || HF_DEFAULT_URL,
    model: process.env.HF_MODEL || HF_DEFAULT_MODEL,
    token: process.env.HF_TOKEN || null,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 20000,
  };
}

/** Send chat messages, get back the model's reply text. Throws on any failure. */
export async function callModel(messages) {
  const cfg = getConfig();

  if (cfg.mode === "huggingface" && !cfg.token) {
    const err = new Error("HF_TOKEN is not set (or set LLM_MODE=local to use a local model)");
    err.code = "NO_TOKEN"; // lets the caller skip retries
    throw err;
  }

  // Qwen3 "thinks" before answering, which is slow and wastes tokens. "/no_think" turns it off.
  let msgs = messages;
  if (/qwen3/i.test(cfg.model)) {
    msgs = messages.map((m, i) =>
      i === messages.length - 1 && m.role === "user" ? { ...m, content: m.content + "\n/no_think" } : m
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      },
      body: JSON.stringify({ model: cfg.model, temperature: 0, max_tokens: 800, messages: msgs }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // include the server's reason (e.g. "model not supported") so the error is useful
      let detail = "";
      try {
        detail = (await res.text()).replace(/\s+/g, " ").slice(0, 300);
      } catch {}
      throw new Error(`LLM request failed (${cfg.mode}, model ${cfg.model}) status ${res.status}${detail ? ": " + detail : ""}`);
    }

    const data = await res.json();
    let content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Empty reply from model");
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim(); // drop Qwen3 thinking block
    if (!content) throw new Error("Empty reply from model");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull a JSON object out of a model reply (handles ```json fences and extra text). */
export function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model reply");
  return JSON.parse(text.slice(start, end + 1));
}