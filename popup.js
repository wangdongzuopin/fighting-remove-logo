document.getElementById("openAppBtn").addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  window.close();
});
