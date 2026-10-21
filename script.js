document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.action === "register" ? "register" : "login";
    window.location.href = `/auth/google?mode=${mode}&returnTo=/organization-chart.html`;
  });
});

const typingLines = document.querySelectorAll("[data-typing-line]");
const typingMessages = [
  "Sứ mệnh: Đồng hành cùng cộng đồng thời trang bền vững, mang đến sản phẩm linen chất lượng và kiến tạo cơ hội kinh doanh đáng tự hào.",
  "Tầm nhìn: Đến năm 2035, trở thành nền tảng kết nối và phát triển hệ sinh thái thời trang bền vững hàng đầu Việt Nam.",
  "Giá trị cốt lõi: Dụng tâm · Cộng sinh · Học hỏi phát triển.",
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
        setTimeout(typeNextCharacter, 28);
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