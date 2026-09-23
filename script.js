document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.action === "register" ? "register" : "login";
    window.location.href = `/auth/google?mode=${mode}&returnTo=/user-management.html`;
  });
});

const typingLines = document.querySelectorAll("[data-typing-line]");
const typingMessages = [
  "Chủ động hôm nay, nhẹ nhàng ngày mai.",
  "Mỗi việc hoàn thành là một bước tiến.",
  "Cùng phối hợp, cùng tạo kết quả tốt.",
  "Làm đúng từ đầu, tiến xa hơn mỗi ngày.",
];

function typeMessageLines() {
  typingLines.forEach((line) => {
    line.textContent = "";
    line.classList.remove("is-active");
  });

  let lineIndex = 0;

  const typeNextLine = () => {
    if (lineIndex >= typingMessages.length) {
      setTimeout(typeMessageLines, 2800);
      return;
    }

    const activeLine = typingLines[lineIndex];
    const message = typingMessages[lineIndex];
    let characterIndex = 0;
    activeLine.classList.add("is-active");

    const typeNextCharacter = () => {
      if (characterIndex < message.length) {
        activeLine.textContent += message[characterIndex];
        characterIndex += 1;
        setTimeout(typeNextCharacter, 52);
        return;
      }

      activeLine.classList.remove("is-active");
      lineIndex += 1;
      setTimeout(typeNextLine, 500);
    };

    typeNextCharacter();
  };

  typeNextLine();
}

if (typingLines.length) typeMessageLines();

const motivationQuote = document.querySelector("[data-motivation-quote]");
const motivationProgress = document.querySelector("[data-motivation-progress]");
const motivationQuotes = [
  "Việc nhỏ làm tốt hôm nay tạo nên khác biệt lớn ngày mai.",
  "Phối hợp tốt hơn, hoàn thành nhẹ nhàng hơn.",
  "Chủ động một bước, cả quy trình tiến về phía trước.",
  "Mỗi nhiệm vụ hoàn thành là một dấu mốc đáng tự hào.",
];
let motivationIndex = 0;

if (motivationQuote) {
  setInterval(() => {
    motivationIndex = (motivationIndex + 1) % motivationQuotes.length;
    motivationQuote.classList.remove("is-rotating");
    void motivationQuote.offsetWidth;
    motivationQuote.textContent = motivationQuotes[motivationIndex];
    motivationQuote.classList.add("is-rotating");
    if (motivationProgress) {
      motivationProgress.style.animation = "none";
      void motivationProgress.offsetWidth;
      motivationProgress.style.animation = "quote-progress 4.5s linear infinite";
    }
  }, 4500);

  motivationQuote.classList.add("is-rotating");
}

const ambientTrack = document.querySelector("[data-ambient-track]");
const ambientCards = ambientTrack ? [...ambientTrack.querySelectorAll(".ambient-message-card")] : [];
let ambientIndex = 0;

if (ambientTrack && ambientCards.length) {
  setInterval(() => {
    ambientIndex = (ambientIndex + 1) % ambientCards.length;
    ambientCards.forEach((card, index) => card.classList.toggle("is-active", index === ambientIndex));
    ambientTrack.style.transform = `translateY(-${ambientIndex * 162}px)`;
  }, 4500);
}