const form = document.querySelector("#server-form");
const serverUrlInput = document.querySelector("#server-url");
const errorMessage = document.querySelector("#form-error");
const connectButton = document.querySelector("#connect-button");

window.desktopSettings.getServerUrl().then((serverUrl) => {
  serverUrlInput.value = serverUrl;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  connectButton.disabled = true;
  connectButton.textContent = "Đang kết nối...";

  const result = await window.desktopSettings.saveServerUrl(serverUrlInput.value);
  if (!result.ok) {
    errorMessage.textContent = result.error;
    errorMessage.hidden = false;
    connectButton.disabled = false;
    connectButton.textContent = "Kết nối";
  }
});