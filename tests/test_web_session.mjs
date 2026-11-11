// tests/test_web_session.mjs
const code = `program TestWebInteractive
kamus
    nama : string
    umur : integer
algoritma
    output("Siapa nama kamu?")
    input(nama)
    output("Berapa umur kamu?")
    input(umur)
    output("Halo,", nama, "- tahun depan kamu berumur", umur + 1)
endprogram`;

async function runTest() {
  console.log("1. Starting session with interactive code...");
  const res = await fetch("http://localhost:3000/api/session/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: code }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Failed to start session: HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sessionId = null;
  let inputStep = 0;
  const stdoutLines = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const ev of events) {
      const line = ev.trim();
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.replace(/^data:\s*/, "");
      if (!jsonStr) continue;

      const event = JSON.parse(jsonStr);
      console.log("Received SSE event:", event.type, event);

      if (event.type === "init") {
        sessionId = event.sessionId;
      } else if (event.type === "stdout") {
        stdoutLines.push(event.text);
      } else if (event.type === "need_input") {
        inputStep++;
        if (inputStep === 1) {
          console.log("-> Sending input 1 (Budi)...");
          await fetch("http://localhost:3000/api/session/input", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, input: "Budi" }),
          });
        } else if (inputStep === 2) {
          console.log("-> Sending input 2 (19)...");
          await fetch("http://localhost:3000/api/session/input", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, input: "19" }),
          });
        }
      } else if (event.type === "exit") {
        console.log("-> Process exited with code:", event.code, `(${event.durationMs}ms)`);
        break;
      }
    }
  }

  const allOutput = stdoutLines.join("");
  console.log("Total stdout collected:\n" + allOutput);

  if (!allOutput.includes("Halo, Budi - tahun depan kamu berumur 20")) {
    throw new Error("Assertion failed: expected greeting and calculated age not found!");
  }

  console.log("=== Interactive Runner SSE Web Test Passed Successfully! ===");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
