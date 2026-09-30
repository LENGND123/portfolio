const data = JSON.parse(document.getElementById("contrib").textContent);
const graph = document.getElementById("graph");
const months = document.getElementById("months");

function shift(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function level(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let previousMonth = -1;
let lastLabeled = -10;

data.cols.forEach((week, column) => {
  const counts = new Map();
  week.forEach((_, day) => {
    const month = shift(data.start, column * 7 + day).getUTCMonth();
    counts.set(month, (counts.get(month) || 0) + 1);
  });
  let bestMonth = 0;
  let bestCount = 0;
  counts.forEach((count, month) => {
    if (count > bestCount) {
      bestMonth = month;
      bestCount = count;
    }
  });
  const label = document.createElement("span");
  if (bestMonth !== previousMonth && column - lastLabeled >= 3) {
    label.textContent = monthNames[bestMonth];
    previousMonth = bestMonth;
    lastLabeled = column;
  }
  months.append(label);

  week.forEach((count, day) => {
    const cell = document.createElement("span");
    cell.className = "cell";
    cell.dataset.l = String(level(count));
    const when = shift(data.start, column * 7 + day);
    const pretty = when.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    const noun = count === 1 ? "contribution" : "contributions";
    cell.title = `${pretty}: ${count} ${noun}`;
    graph.append(cell);
  });
});

const beds = document.getElementById("beds");
if (beds) {
  const taken = new Set([0, 1, 3, 4, 6, 8, 9, 11, 14, 15, 18, 20, 22, 25, 27, 30, 33, 36, 39, 42]);
  for (let index = 0; index < 45; index += 1) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const column = index % 15;
    const row = Math.floor(index / 15);
    rect.setAttribute("x", String(28 + column * 40));
    rect.setAttribute("y", String(58 + row * 64));
    rect.setAttribute("width", "32");
    rect.setAttribute("height", "48");
    rect.setAttribute("rx", "6");
    rect.setAttribute("fill", taken.has(index) ? "#1d6b34" : "#d9d3c4");
    beds.append(rect);
  }
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduceMotion) {
  document.querySelectorAll(".note").forEach((note) => {
    let originX = 0;
    let originY = 0;
    let movedX = 0;
    let movedY = 0;
    let dragging = false;
    const rot = note.dataset.rot || "0";

    note.addEventListener("pointerdown", (event) => {
      if (getComputedStyle(note).position !== "absolute") return;
      dragging = true;
      originX = event.clientX;
      originY = event.clientY;
      note.setPointerCapture(event.pointerId);
    });

    note.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const x = movedX + event.clientX - originX;
      const y = movedY + event.clientY - originY;
      note.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    });

    const end = (event) => {
      if (!dragging) return;
      dragging = false;
      movedX += event.clientX - originX;
      movedY += event.clientY - originY;
    };

    note.addEventListener("pointerup", end);
    note.addEventListener("pointercancel", end);
  });
}

const form = document.getElementById("hello");
const status = document.getElementById("form-status");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const name = String(fields.get("name")).trim();
  const email = String(fields.get("email")).trim();
  const subject = String(fields.get("subject")).trim();
  const message = String(fields.get("message")).trim();
  const body = `${message}\n\n— ${name}\n${email}`;
  const href = `mailto:sadityaraj369@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  status.textContent = "Opening your email app with this message.";
  window.location.href = href;
});
