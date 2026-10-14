export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[a-f0-9-]{12}$/.test(id)) return Response.json({ state: "error" }, { status: 400 });
  const h = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "mod-ai", Accept: "application/vnd.github+json" };
  const rel = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/releases/tags/${id}`, { headers: h });
  if (rel.ok) {
    const a = (await rel.json()).assets?.[0];
    if (a) return Response.json({ state: "done", url: a.browser_download_url, file: a.name });
  }
  const runs = await (await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/build.yml/runs?per_page=30`, { headers: h })).json();
  const run = runs.workflow_runs?.find((x) => x.display_title === `build-${id}`);
  if (run?.status === "completed" && run.conclusion !== "success") return Response.json({ state: "failed" });
  return Response.json({ state: "building" });
}
