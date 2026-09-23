async function loadPendingUser() {
  const response = await fetch("/api/me");
  if (!response.ok) return;
  const data = await response.json();
  if (!data.user) return;

  const name = data.user.name || "Tài khoản Google";
  document.querySelector("[data-pending-name]").textContent = name;
  document.querySelector("[data-pending-email]").textContent = data.user.email || "";
  const avatar = document.querySelector("[data-pending-avatar]");
  if (data.user.picture) {
    const image = document.createElement("img");
    image.src = data.user.picture;
    image.referrerPolicy = "no-referrer";
    image.alt = `Ảnh đại diện của ${name}`;
    avatar.replaceChildren(image);
  } else {
    avatar.textContent = name.charAt(0).toUpperCase();
  }
}

loadPendingUser().catch(() => {});
