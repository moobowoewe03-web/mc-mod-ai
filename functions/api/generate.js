const SYSTEM = `You write Minecraft Fabric mods for Minecraft 26.3 (Java 25, Fabric API 0.160.5+26.3).
Minecraft 26.x is unobfuscated: use official Mojang class names (net.minecraft.*). ResourceLocation is now named Identifier.
Return ONLY JSON: {"modId":"lowercase_snake","name":"Display Name","mainClass":"com.modai.mymod.MyMod","files":{"src/main/java/com/modai/mymod/MyMod.java":"...","src/main/resources/assets/mymod/lang/en_us.json":"..."}}
Rules: mainClass implements net.fabricmc.api.ModInitializer. Do NOT create fabric.mod.json (added automatically).
Keep it small and compilable. Use only Minecraft and Fabric API classes. No networking, no file access, no reflection.`;

export async function onRequestPost({ request, env }) {
  const { prompt } = await request.json();
  if (!prompt || prompt.length > 1500) return Response.json({ error: "프롬프트가 비었거나 너무 깁니다." }, { status: 400 });
  const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!ai.ok) return Response.json({ error: "AI 호출 실패 (무료 한도 초과일 수 있어요)" }, { status: 502 });
  const text = (await ai.json()).candidates?.[0]?.content?.parts?.[0]?.text;
  let mod; try { mod = JSON.parse(text); } catch { return Response.json({ error: "AI 응답을 해석하지 못했어요. 다시 시도해 주세요." }, { status: 502 }); }
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(mod))));
  if (payload.length > 60000) return Response.json({ error: "모드가 너무 커요. 더 간단히 요청해 주세요." }, { status: 400 });
  const id = crypto.randomUUID().slice(0, 12);
  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/build.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "mod-ai", Accept: "application/vnd.github+json" },
    body: JSON.stringify({ ref: "main", inputs: { job_id: id, payload } }),
  });
  if (!r.ok) return Response.json({ error: "빌드 시작 실패" }, { status: 502 });
  return Response.json({ id, name: mod.name });
}
