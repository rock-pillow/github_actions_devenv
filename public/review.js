document.querySelector("#decision")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitter = event.submitter;
  const fd = new FormData(form);
  const payload = {
    token: fd.get("token"),
    version: Number(fd.get("version")),
    decision: submitter?.value,
    name: fd.get("name"),
    comment: fd.get("comment")
  };
  const result = document.querySelector("#result");
  try {
    const res = await fetch("/api/decision", {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "送信できませんでした");
    form.querySelectorAll("button,input,textarea").forEach(el=>el.disabled=true);
    result.textContent = payload.decision === "confirmed" ? "承認しました。" : "修正依頼を送信しました。";
  } catch (err) {
    result.textContent = err.message;
  }
});
