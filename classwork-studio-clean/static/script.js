/* Classwork Studio - Frontend logic
 * - Three-level cascading dropdowns (level / subject / difficulty)
 * - Calls /api/generate to fetch Markdown
 * - Renders, copies, exports to PDF / DOCX
 */

// Subjects available for primary school
const PRIMARY_SUBJECTS = [
  "Chinese Language",
  "English Language",
  "Mathematics",
  "General Studies",
  "Putonghua",
  "Music",
  "Physical Education",
  "Visual Arts",
  "Computer Studies"
];

// Subjects available for secondary school
const SECONDARY_SUBJECTS = [
  "Chinese Language",
  "English Language",
  "Mathematics",
  "Citizenship and Social Development",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Economics",
  "BAFS (Accounting)",
  "BAFS (Business)",
  "Information and Communication Technology",
  "Visual Arts",
  "Music",
  "Physical Education"
];

// DOM references
const levelSelect = document.getElementById("level");
const subjectSelect = document.getElementById("subject");
const difficultySelect = document.getElementById("difficulty");
const chineseVersionCheckbox = document.getElementById("chinese-version");
const overallNotesTextarea = document.getElementById("overall-notes");
const modelSelect = document.getElementById("model-select");
const curriculumFileSelect = document.getElementById("curriculum-file");
const generateBtn = document.getElementById("generate-btn");
const errorMsg = document.getElementById("error-msg");
const resultSection = document.getElementById("result-section");
const output = document.getElementById("output");
const copyBtn = document.getElementById("copy-btn");
const pdfBtn = document.getElementById("pdf-btn");
const docxBtn = document.getElementById("docx-btn");
const statsBar = document.getElementById("stats-bar");

// Cache the latest generated Markdown (for copy / re-export)
let currentMarkdown = "";

/**
 * Fetch the list of available curriculum files from the backend
 * and populate the dropdown.
 */
async function fetchCurriculumFiles() {
  try {
    const response = await fetch("/api/curriculum/files", { credentials: 'include' });
    if (response.status === 401) { handleUnauthorized(); return; }
    const data = await response.json();
    const files = data.files || [];

    // Keep the first placeholder option
    curriculumFileSelect.innerHTML = '<option value="">-- No curriculum file --</option>';

    files.forEach((filename) => {
      const opt = document.createElement("option");
      opt.value = filename;
      opt.textContent = filename;
      curriculumFileSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("[Classwork Studio] Failed to fetch curriculum files:", err);
  }
}

/**
 * Dynamically update the Subject dropdown based on the selected Level.
 * Clears the result area when level changes.
 */
function updateSubjectOptions() {
  const level = levelSelect.value;
  subjectSelect.innerHTML = ""; // clear existing options

  if (!level) {
    subjectSelect.disabled = true;
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Select level first";
    opt.disabled = true;
    opt.selected = true;
    subjectSelect.appendChild(opt);
    return;
  }

  // Pick subject list based on the level prefix
  const subjects = level.startsWith("Primary") ? PRIMARY_SUBJECTS : SECONDARY_SUBJECTS;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select subject";
  placeholder.disabled = true;
  placeholder.selected = true;
  subjectSelect.appendChild(placeholder);

  subjects.forEach((subject) => {
    const opt = document.createElement("option");
    opt.value = subject;
    opt.textContent = subject;
    subjectSelect.appendChild(opt);
  });

  subjectSelect.disabled = false;

  // Clear previous output when level changes
  clearResult();
}

/**
 * Clear the result area and any error message.
 */
function clearResult() {
  resultSection.hidden = true;
  output.innerHTML = "";
  currentMarkdown = "";
  hideError();
}

/**
 * Display an error message to the user.
 */
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.add("show");
}

/**
 * Hide any displayed error message.
 */
function hideError() {
  errorMsg.textContent = "";
  errorMsg.classList.remove("show");
}

/**
 * Show or hide the progress bar.
 */
function showProgress(show) {
  const section = document.getElementById("progress-section");
  if (show) {
    section.hidden = false;
    document.getElementById("progress-text").textContent = "Generating worksheet...";
    document.getElementById("progress-bar").style.width = "5%";
    document.getElementById("progress-timer").textContent = "0s";
  } else {
    section.hidden = true;
  }
}

/**
 * Start an exponentially-decaying progress animation.
 * Reaches 99% at t = 180s, using progress(t) = 100 * (1 - exp(-k * t))
 * with k = -ln(0.01) / 180 ≈ 0.0256.
 */
function startProgressAnimation() {
  let seconds = 0;
  const timerEl = document.getElementById("progress-timer");
  const barEl = document.getElementById("progress-bar");
  const textEl = document.getElementById("progress-text");

  // Whimsical status messages shown every few seconds
  const funMessages = [
    "Asking AI to think really hard...",
    "Brain cells firing rapidly...",
    "Loading oodles of knowledge...",
    "Teaching the AI new tricks...",
    "Almost done, just polishing...",
    "Final touches being applied...",
    "Dotting the i's and crossing the t's...",
    "Organising everything neatly...",
    "Counting all the marks...",
    "Crafting the perfect worksheet..."
  ];
  let lastMessageIndex = -1;

  // Milestone messages shown at round percentages
  const milestones = {
    10:  "Warming up the engine...",
    25:  "Gathering curriculum context...",
    50:  "Designing question structure...",
    75:  "Writing the questions...",
    90:  "Reviewing for quality...",
    99:  "Final stretch - 99%!",
    100: "Complete!"
  };

  const k = 0.0256; // exponential decay coefficient

  const interval = setInterval(() => {
    // If the timer span was hidden (e.g. by the real progress takeover),
    // stop touching the DOM and kill this interval.
    if (!timerEl || timerEl.style.display === "none" || timerEl.hidden) {
      clearInterval(interval);
      return;
    }
    seconds += 1;
    timerEl.textContent = `${seconds}s`;

    // Exponential approach: fast at first, slow near the end
    let progress = 100 * (1 - Math.exp(-k * seconds));
    // Cap at 99.5% so the bar never visually "sits" at 100%
    progress = Math.min(progress, 99.5);
    barEl.style.width = `${progress}%`;

    // Milestone message
    const intProgress = Math.floor(progress);
    if (milestones[intProgress] && textEl.textContent !== milestones[intProgress]) {
      textEl.textContent = milestones[intProgress];
    } else if (seconds > 0 && seconds % 8 === 0) {
      // Pick a fun message every 8 seconds (no repeats)
      let idx;
      do {
        idx = Math.floor(Math.random() * funMessages.length);
      } while (idx === lastMessageIndex && funMessages.length > 1);
      lastMessageIndex = idx;
      textEl.textContent = funMessages[idx];
    }
  }, 1000);

  return interval;
}

/**
 * Toggle the loading state of the main Generate button.
 */
function setLoading(loading) {
  if (loading) {
    generateBtn.disabled = true;
    generateBtn.classList.add("loading");
    generateBtn.querySelector(".btn-text").textContent = "Generating";
  } else {
    generateBtn.disabled = false;
    generateBtn.classList.remove("loading");
    generateBtn.querySelector(".btn-text").textContent = "Generate Classwork";
  }
}

/**
 * Call the backend to generate a worksheet.
 */
async function generateClasswork() {
  hideError();

  const level = levelSelect.value;
  const subject = subjectSelect.value;
  const difficulty = difficultySelect.value;
  const curriculumFile = curriculumFileSelect.value;

  if (!level || !subject || !difficulty) {
    showError("Please select level, subject, and difficulty.");
    return;
  }

  // Warn the user if the result viewer already has content
  if (currentMarkdown && currentMarkdown.trim().length > 0) {
    const confirmed = confirm(
      "The result viewer already contains a worksheet.\n\n" +
      "Generating a new one will clear the existing content (PDF/DOCX files are not affected and can be re-downloaded).\n\n" +
      "Continue?"
    );
    if (!confirmed) {
      return;
    }
    output.innerHTML = "";
    statsBar.innerHTML = "";
    currentMarkdown = "";
  }

  setLoading(true);
  showProgress(true);
  const progressInterval = startProgressAnimation();

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, subject, difficulty, curriculumFile, chineseVersion: chineseVersionCheckbox?.checked || false, overallNotes: overallNotesTextarea?.value || "", model: modelSelect?.value || "" }),
      credentials: 'include'
    });

    if (response.status === 401) { handleUnauthorized(); return; }
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data.error || "Generation failed. Please try again.";
      showError(message);
      return;
    }

    const markdown = data.content || "";
    currentMarkdown = markdown;

    output.innerHTML = renderWorksheet(markdown);
    renderMath();

    const time = data.time || 0;
    const tokens = data.tokens || {};
    const finishReason = data.finish_reason || 'unknown';
    const finishReasonLabel = {
      'stop': 'Done',
      'length': 'Truncated',
      'content_filter': 'Filtered',
      'unknown': 'Unknown'
    }[finishReason] || finishReason;

    statsBar.innerHTML = `
      <span><span class="label">Time</span><span class="value">${time}s</span></span>
      <span><span class="label">Input</span><span class="value">${tokens.prompt || 0}</span></span>
      <span><span class="label">Output</span><span class="value">${tokens.completion || 0}</span></span>
      <span><span class="label">Total</span><span class="value">${tokens.total || 0}</span></span>
      <span><span class="label">Status</span><span class="value">${finishReasonLabel}</span></span>
    `;

    // Mark the progress bar as complete
    clearInterval(progressInterval);
    document.getElementById("progress-bar").style.width = "100%";
    document.getElementById("progress-text").textContent = "Done!";

    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Hide the progress bar after 1.5s
    setTimeout(() => showProgress(false), 1500);
  } catch (err) {
    console.error("[Classwork Studio] Request failed:", err);
    showError("Generation failed. Please try again.");
    clearInterval(progressInterval);
    showProgress(false);
  } finally {
    setLoading(false);
  }
}

/**
 * Copy the raw Markdown to the clipboard.
 */
async function copyToClipboard() {
  if (!currentMarkdown) {
    showError("No content to copy.");
    return;
  }
  try {
    await navigator.clipboard.writeText(currentMarkdown);
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = original;
    }, 1500);
  } catch (err) {
    console.error("[Classwork Studio] Copy failed:", err);
    showError("Copy failed. Please select the text manually.");
  }
}

/**
 * Export the result area to a PDF file using html2pdf.js.
 * Creates a clean temporary container to avoid layout issues.
 */
async function downloadAsPDF() {
  if (!currentMarkdown) {
    showError("No content to download. Please generate a worksheet first.");
    return;
  }

  const originalLabel = pdfBtn.textContent;
  pdfBtn.disabled = true;
  pdfBtn.textContent = "Preparing PDF...";

  const safeLevel = (levelSelect.value || "worksheet").replace(/[^\w]+/g, "_");
  const safeSubject = (subjectSelect.value || "class").replace(/[^\w]+/g, "_");
  const filename = `Classwork_${safeLevel}_${safeSubject}.pdf`;

  const tempContainer = document.createElement("div");
  tempContainer.id = "pdf-export-container";
  tempContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%;
    background: #ffffff;
    z-index: 9999;
    padding: 20px;
    box-sizing: border-box;
    overflow: hidden;
  `;
  
  tempContainer.innerHTML = renderWorksheet(currentMarkdown);
  
  document.body.appendChild(tempContainer);

  await new Promise(resolve => setTimeout(resolve, 300));

  const contentWidth = tempContainer.scrollWidth;
  const contentHeight = tempContainer.scrollHeight;

  tempContainer.style.height = contentHeight + "px";

  await new Promise(resolve => setTimeout(resolve, 200));

  const opt = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: "png", quality: 1.0 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: contentWidth,
      windowHeight: contentHeight,
      scrollY: 0,
      scrollX: 0,
      logging: false,
      allowTaint: true
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] }
  };

  const cleanup = () => {
    if (tempContainer && tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }
    pdfBtn.textContent = originalLabel;
    pdfBtn.disabled = false;
  };

  pdfBtn.textContent = "Generating PDF...";

  try {
    await html2pdf()
      .set(opt)
      .from(tempContainer)
      .save();
    
    cleanup();
    pdfBtn.textContent = "Downloaded!";
    setTimeout(() => {
      pdfBtn.textContent = originalLabel;
    }, 1500);
  } catch (err) {
    console.error("[Classwork Studio] PDF generation failed:", err);
    cleanup();
    showError("PDF generation failed. Try again or use Ctrl+P to print to PDF.");
  }
}

// ===== Event bindings =====
levelSelect.addEventListener("change", updateSubjectOptions);
generateBtn.addEventListener("click", generateClasswork);
copyBtn.addEventListener("click", copyToClipboard);
pdfBtn.addEventListener("click", downloadAsPDF);
docxBtn.addEventListener("click", downloadAsDOCX);

// ===== Custom Worksheet Builder event bindings =====
// Show the builder section only when the checkbox is ticked,
// and hide the quick Generate button at the same time.
// (Level / Subject / Curriculum file remain visible because the builder needs them.)
const enableCustomBuilder = document.getElementById("enable-custom-builder");
const customBuilderSection = document.getElementById("custom-builder-section");
const quickGenerateBtnWrap = document.getElementById("quick-generate-btn-wrap");

enableCustomBuilder.addEventListener("change", () => {
  const isCustom = enableCustomBuilder.checked;
  customBuilderSection.hidden = !isCustom;
  quickGenerateBtnWrap.hidden = isCustom; // hide the quick Generate button when custom mode is on
  if (isCustom) {
    // Auto-add a first part block for a friendlier onboarding
    if (partsList.children.length === 0) {
      addPartBlock();
    }
  }
});

document.getElementById("add-part-btn").addEventListener("click", addPartBlock);
document.getElementById("generate-custom-btn").addEventListener("click", generateCustomClasswork);

// Disable the Subject dropdown until a level is chosen
subjectSelect.disabled = true;

// Fetch available curriculum files on page load
fetchCurriculumFiles();

/**
 * Call /api/export/docx to download a DOCX file of the current worksheet.
 */
async function downloadAsDOCX() {
  if (!currentMarkdown) {
    showError("No content to download. Please generate a worksheet first.");
    return;
  }

  const originalLabel = docxBtn.textContent;
  docxBtn.disabled = true;
  docxBtn.textContent = "Generating DOCX...";

  try {
    const response = await fetch("/api/export/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: currentMarkdown,
        level: levelSelect.value,
        subject: subjectSelect.value
      }),
      credentials: 'include'
    });

    if (response.status === 401) { handleUnauthorized(); return; }

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Export failed" }));
      showError(data.error || "DOCX export failed.");
      docxBtn.textContent = originalLabel;
      docxBtn.disabled = false;
      return;
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = "classwork.docx";
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, "");
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    docxBtn.textContent = "Downloaded!";
    setTimeout(() => {
      docxBtn.textContent = originalLabel;
      docxBtn.disabled = false;
    }, 1500);

  } catch (err) {
    console.error("[Classwork Studio] DOCX export failed:", err);
    showError("DOCX export failed. Please try again.");
    docxBtn.textContent = originalLabel;
    docxBtn.disabled = false;
  }
}

/**
 * Render a worksheet:
 * 1. Convert Markdown to HTML with marked.js
 * 2. Replace [____] / [______] answer placeholders with a styled <span>
 *    so students see a fillable blank line in both screen and PDF.
 *
 * We only match placeholders that occupy an entire block
 * (<p>[____]</p> or <li>[____]</li>) to avoid touching underscores
 * that appear in real answer-key text.
 */
function renderWorksheet(markdown) {
  let html = marked.parse(markdown);

  html = html.replace(
    /\[IMAGE:\s*([^\]]+)\]/g,
    '<div class="image-prompt-container"><div class="image-prompt-box"><span class="image-prompt-label">🖼️ Image Prompt:</span><span class="image-prompt-text">$1</span></div></div>'
  );

  html = html.replace(
    /<(p|li)>\[_{3,}\]<\/\1>/g,
    '<$1><span class="answer-line"></span></$1>'
  );

  html = html.replace(
    /<pre><code>\[_{3,}\]<\/code><\/pre>/g,
    '<p><span class="answer-line"></span></p>'
  );

  html = html.replace(
    /<(p|li)>_{60,}<\/\1>/g,
    '<$1><span class="answer-line"></span></$1>'
  );

  html = html.replace(
    /<pre><code>(_{60,})<\/code><\/pre>/g,
    '<p><span class="answer-line"></span></p>'
  );

  html = html.replace(
    /Answer:\s*Ⓐ\s*Ⓑ\s*Ⓒ\s*Ⓓ/g,
    '<span class="mcq-answer">Answer: <span>Ⓐ</span> <span>Ⓑ</span> <span>Ⓒ</span> <span>Ⓓ</span></span>'
  );

  html = html.replace(
    /<span class="answer-line"><\/span>\.\.\./g,
    '<span class="answer-line"></span>'
  );
  html = html.replace(
    /\.\.\.<span class="answer-line"><\/span>/g,
    '<span class="answer-line"></span>'
  );

  html = html.replace(
    /<(p|li)>\[\s*_{0,}\s*\]<\/\1>/g,
    '<$1><span class="answer-line"></span></$1>'
  );

  html = html.replace(
    /<p>(\[\s*\]\s*){3,}<\/p>/g,
    '<p><span class="answer-line"></span></p>'
  );

  html = html.replace(
    /<pre><code>\[\s*_{0,}\s*\]<\/code><\/pre>/g,
    '<p><span class="answer-line"></span></p>'
  );

  return html;
}

function renderMath() {
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(output, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false}
      ],
      throwOnError: false
    });
  }
}

/* ===========================================================
 * Custom Worksheet Builder
 * Lets the user add/remove Part blocks and call /api/generate-custom
 * =========================================================== */
const partsList = document.getElementById("parts-list");
const weightSumEl = document.getElementById("weight-sum");
const weightStatusEl = document.getElementById("weight-status");
const generateCustomBtn = document.getElementById("generate-custom-btn");

/** Create and return a single Part block DOM element */
function createPartBlock(partNumber) {
  const block = document.createElement("div");
  block.className = "part-block";
  block.setAttribute("role", "listitem");
  block.dataset.partNumber = String(partNumber);
  block.draggable = true;
  block.innerHTML = `
    <div class="part-block-header">
      <button type="button" class="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <h3 class="part-block-title">Part ${partNumber}</h3>
      <button type="button" class="btn-remove-part" aria-label="Remove Part ${partNumber}">×</button>
    </div>
    <div class="part-block-fields">
      <div class="field-row">
        <label>Question Type</label>
        <select class="part-qtype">
          <option value="" disabled selected>Select a type</option>
          <option value="Multiple Choice">Multiple Choice</option>
          <option value="True / False">True / False</option>
          <option value="Fill in the Blanks">Fill in the Blanks</option>
          <option value="Matching">Matching</option>
          <option value="Short Answer">Short Answer</option>
          <option value="Reading Comprehension">Reading Comprehension</option>
          <option value="Cloze / Gap-fill Passage">Cloze / Gap-fill Passage</option>
          <option value="Sentence Transformation">Sentence Transformation</option>
          <option value="Proofreading & Editing">Proofreading &amp; Editing</option>
          <option value="Calculation">Calculation</option>
          <option value="Word Problems">Word Problems</option>
          <option value="Data Analysis">Data Analysis</option>
          <option value="Essay / Composition">Essay / Composition</option>
          <option value="Practical / Lab">Practical / Lab</option>
        </select>
      </div>
      <div class="field-row">
        <label>Difficulty</label>
        <select class="part-difficulty">
          <option value="Basic">Basic</option>
          <option value="Advanced" selected>Advanced</option>
          <option value="Expert">Expert</option>
        </select>
      </div>
      <div class="field-row">
        <label>Weight</label>
        <input type="number" class="part-weight" min="0.1" step="0.1" placeholder="e.g. 2" />
      </div>
      <div class="field-row field-full">
        <label>Notes (optional: topics, number of questions, etc.)</label>
        <div class="notes-wrapper">
          <textarea class="part-notes" rows="2" placeholder="e.g. Focus on tenses, 5 questions"></textarea>
          <button type="button" class="btn-polish-notes" title="Polish notes with AI">
            <span class="polish-icon" aria-hidden="true">✦</span>
            <span class="polish-text">Polish</span>
          </button>
          <div class="polish-suggestion" hidden>
            <div class="polish-suggestion-header">AI suggestion:</div>
            <div class="polish-suggestion-body"></div>
            <div class="polish-suggestion-actions">
              <button type="button" class="btn-accept-polish">Accept</button>
              <button type="button" class="btn-cancel-polish">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Remove button
  block.querySelector(".btn-remove-part").addEventListener("click", () => {
    block.remove();
    renumberParts();
    updateWeightSummary();
  });

  // Update the running total as the user types
  block.querySelector(".part-weight").addEventListener("input", updateWeightSummary);

  // Polish notes button
  block.querySelector(".btn-polish-notes").addEventListener("click", () => {
    polishPartNotes(block);
  });

  // ---- Drag & drop reordering (HTML5 native, no library) ----
  block.addEventListener("dragstart", (e) => {
    draggedBlock = block;
    block.classList.add("dragging");
    // Required for Firefox to start the drag
    try { e.dataTransfer.setData("text/plain", String(partNumber)); } catch (_) {}
    e.dataTransfer.effectAllowed = "move";
  });

  block.addEventListener("dragend", () => {
    block.classList.remove("dragging");
    // Clear any leftover visual hints on siblings
    Array.from(partsList.children).forEach((child) => {
      child.classList.remove("drag-over-top", "drag-over-bottom");
    });
    draggedBlock = null;
  });

  block.addEventListener("dragover", (e) => {
    if (!draggedBlock || draggedBlock === block) return;
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = "move";

    // Decide whether to insert before or after based on cursor position
    const rect = block.getBoundingClientRect();
    const halfway = rect.top + rect.height / 2;
    block.classList.toggle("drag-over-top", e.clientY < halfway);
    block.classList.toggle("drag-over-bottom", e.clientY >= halfway);
  });

  block.addEventListener("dragleave", () => {
    block.classList.remove("drag-over-top", "drag-over-bottom");
  });

  block.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!draggedBlock || draggedBlock === block) return;
    const rect = block.getBoundingClientRect();
    const halfway = rect.top + rect.height / 2;
    if (e.clientY < halfway) {
      partsList.insertBefore(draggedBlock, block);
    } else {
      partsList.insertBefore(draggedBlock, block.nextSibling);
    }
    block.classList.remove("drag-over-top", "drag-over-bottom");
    renumberParts();
    updateWeightSummary();
  });

  return block;
}

/** Currently-dragged Part block (set on dragstart, cleared on dragend). */
let draggedBlock = null;

/** Append a new Part block to the list */
function addPartBlock() {
  const nextNum = partsList.children.length + 1;
  partsList.appendChild(createPartBlock(nextNum));
  updateWeightSummary();
}

/** Re-number all Part blocks (called after removal) */
function renumberParts() {
  Array.from(partsList.children).forEach((block, idx) => {
    const num = idx + 1;
    block.dataset.partNumber = String(num);
    const title = block.querySelector(".part-block-title");
    if (title) title.textContent = `Part ${num}`;
    const btn = block.querySelector(".btn-remove-part");
    if (btn) btn.setAttribute("aria-label", `Remove Part ${num}`);
  });
}

/** Recalculate the weight total and enable/disable the submit button.
 *  Weights are RELATIVE values (any positive number) and will be
 *  normalised to 100% on the server. The UI shows both the raw total
 *  and the resulting percentage of each part.
 */
function updateWeightSummary() {
  let total = 0;
  Array.from(partsList.querySelectorAll(".part-weight")).forEach((input) => {
    const v = parseFloat(input.value);
    if (!isNaN(v) && v > 0) total += v;
  });
  weightSumEl.textContent = String(Math.round(total * 100) / 100);

  // Submit button is enabled as long as there is at least one valid Part.
  if (partsList.children.length > 0 && total > 0) {
    weightStatusEl.textContent = "(auto-normalised to 100% on submit)";
    weightStatusEl.className = "weight-status ok";
    generateCustomBtn.disabled = false;
  } else {
    if (partsList.children.length === 0) {
      weightStatusEl.textContent = "(add at least 1 part)";
    } else {
      weightStatusEl.textContent = "(enter weights for all parts)";
    }
    weightStatusEl.className = "weight-status bad";
    generateCustomBtn.disabled = true;
  }
}

/** Collect all Part block data as a JSON array */
function collectPartsData() {
  return Array.from(partsList.children).map((block, idx) => {
    return {
      part_number: idx + 1,
      difficulty: block.querySelector(".part-difficulty").value || "Advanced",
      question_type: (block.querySelector(".part-qtype").value || "").trim(),
      weight: parseFloat(block.querySelector(".part-weight").value) || 0,
      notes: (block.querySelector(".part-notes").value || "").trim()
    };
  });
}

/** Validate all Part data.
 *  Weights are RELATIVE — no need to sum to 100 (server will normalise). */
function validateParts(parts) {
  if (parts.length === 0) {
    return "Please add at least one part.";
  }
  for (const p of parts) {
    if (!p.question_type) {
      return `Part ${p.part_number}: please select a question type.`;
    }
    if (!p.weight || p.weight <= 0) {
      return `Part ${p.part_number}: weight must be greater than 0.`;
    }
  }
  return null;
}

/** Send the current notes of a Part block to the backend for AI polishing.
 *  The polished text is shown to the user; they can Accept (overwrite) or Cancel.
 */
async function polishPartNotes(block) {
  const notesEl = block.querySelector(".part-notes");
  const polishBtn = block.querySelector(".btn-polish-notes");
  const suggestion = block.querySelector(".polish-suggestion");
  const suggestionBody = block.querySelector(".polish-suggestion-body");
  const acceptBtn = block.querySelector(".btn-accept-polish");
  const cancelBtn = block.querySelector(".btn-cancel-polish");

  const notes = (notesEl.value || "").trim();
  if (!notes) {
    alert("Please write some notes first, then click Polish.");
    notesEl.focus();
    return;
  }

  const level = levelSelect.value;
  const subject = subjectSelect.value;
  const questionType = block.querySelector(".part-qtype").value;
  const difficulty = block.querySelector(".part-difficulty").value;

  if (!level || !subject) {
    alert("Please select Level and Subject first.");
    return;
  }
  if (!questionType) {
    alert("Please select a Question Type for this part first.");
    return;
  }

  // Enter loading state
  const originalBtnHtml = polishBtn.innerHTML;
  polishBtn.disabled = true;
  polishBtn.classList.add("loading");
  polishBtn.innerHTML = '<span class="polish-text">Polishing…</span>';

  try {
    const response = await fetch("/api/ai/polish-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        subject,
        question_type: questionType,
        difficulty,
        notes
      }),
      credentials: 'include'
    });

    if (response.status === 401) { handleUnauthorized(); return; }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(data.error || "Polishing failed. Please try again.");
      return;
    }

    const polished = (data.polished || "").trim();
    if (!polished) {
      alert("AI returned an empty suggestion. Please try again.");
      return;
    }

    // Show the suggestion panel
    suggestionBody.textContent = polished;
    suggestion.hidden = false;
    suggestion.dataset.originalNotes = notes;

    // Wire up Accept / Cancel (replace any prior handlers)
    const newAccept = acceptBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newAccept.addEventListener("click", () => {
      notesEl.value = polished;
      suggestion.hidden = true;
    });
    newCancel.addEventListener("click", () => {
      suggestion.hidden = true;
    });
  } catch (err) {
    console.error("[Classwork Studio] Polish notes request failed:", err);
    alert("Polishing failed. Please try again.");
  } finally {
    polishBtn.disabled = false;
    polishBtn.classList.remove("loading");
    polishBtn.innerHTML = originalBtnHtml;
  }
}

/** Call /api/generate-custom — uses SSE streaming for real-time output. */
async function generateCustomClasswork() {
  hideError();

  const level = levelSelect.value;
  const subject = subjectSelect.value;
  const curriculumFile = curriculumFileSelect ? curriculumFileSelect.value : "";
  if (!level || !subject) {
    showError("Please select Level and Subject first.");
    return;
  }

  const parts = collectPartsData();
  const err = validateParts(parts);
  if (err) {
    showError(err);
    return;
  }

  // Warn if there is existing content
  if (currentMarkdown && currentMarkdown.trim().length > 0) {
    const confirmed = confirm(
      "The result viewer already contains a worksheet.\n\n" +
      "Generating a new custom worksheet will clear the existing content (PDF/DOCX are not affected and can be re-downloaded).\n\n" +
      "Continue?"
    );
    if (!confirmed) return;
    output.innerHTML = "";
    statsBar.innerHTML = "";
    currentMarkdown = "";
  }

  // Enter loading state
  generateCustomBtn.disabled = true;
  generateCustomBtn.classList.add("loading");
  generateCustomBtn.querySelector(".btn-text").textContent = "Generating...";
  showProgress(true);

  // Target char estimate — caps at 95% so the bar visually completes
  // only when the server's "done" event arrives.
  const ESTIMATED_TOTAL_CHARS = 14000;
  // The fake animation covers the gap before the first chunk arrives
  // (network round-trip). Once the first chunk lands, we stop it and
  // let the real byte-count progress take over.
  const progressInterval = startProgressAnimation();

  // No hard total timeout: the user can wait as long as the model keeps
  // streaming. We still abort if the stream goes SILENT (no chunk or
  // keep-alive) for SILENCE_TIMEOUT_MS, which catches genuine stalls.
  const SILENCE_TIMEOUT_MS = 5 * 60 * 1000;
  let lastActivity = Date.now();

  let accContent = "";
  const startTime = Date.now();
  let controller = null;

  try {
    controller = new AbortController();
    const response = await fetch("/api/generate-custom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({ level, subject, parts, curriculumFile, chineseVersion: chineseVersionCheckbox?.checked || false, overallNotes: overallNotesTextarea?.value || "", model: modelSelect?.value || "", stream: true }),
      signal: controller.signal,
      credentials: 'include'
    });

    if (response.status === 401) { handleUnauthorized(); return; }

    if (!response.ok || !response.body) {
      const errData = await response.json().catch(() => ({}));
      showError(errData.error || "Generation failed. Please try again.");
      return;
    }

    // Plain-text streaming container: we append text chunks directly
    // without re-running the markdown renderer, which would otherwise
    // cause the main thread to stall on long outputs.
    const streamView = document.createElement("pre");
    streamView.className = "stream-preview";
    streamView.style.cssText = "white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:0.95rem;line-height:1.55;margin:0;padding:0;";
    output.innerHTML = "";
    output.appendChild(streamView);

    // Consume SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalMeta = null;
    let errored = false;
    let firstChunkReceived = false;

    // Silence watchdog: abort if we get neither a chunk nor a keep-alive
    // for SILENCE_TIMEOUT_MS (5 min). Indicates the server/model is stuck.
    const silenceCheckInterval = setInterval(() => {
      if (Date.now() - lastActivity > SILENCE_TIMEOUT_MS) {
        if (controller) controller.abort();
        showError("Stream stalled: no activity for 5 minutes. Aborting.");
        showProgress(false);
      }
    }, 30 * 1000);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      lastActivity = Date.now();
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by "\n\n"
      let sepIdx;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        let eventName = "message";
        let dataLines = [];
        rawEvent.split("\n").forEach((line) => {
          // Skip SSE comments (lines starting with ':'), e.g. keep-alive pings
          if (line.startsWith(":")) return;
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        });
        const dataStr = dataLines.join("\n");
        if (!dataStr) continue;

        if (eventName === "start") {
          try {
            const obj = JSON.parse(dataStr);
            if (obj.task_id) {
              loadTaskList();
            }
          } catch (e) {
            console.warn("[Classwork Studio] Bad SSE start:", dataStr);
          }
        } else if (eventName === "chunk") {
          try {
            const obj = JSON.parse(dataStr);
            if (obj.text) {
              accContent += obj.text;
              // Cheap text append — no markdown re-render
              streamView.textContent = accContent;
              // Stop the fake animation after the first chunk so it
              // doesn't fight with the real progress bar.
              if (!firstChunkReceived) {
                clearInterval(progressInterval);
                firstChunkReceived = true;
                // Hide the fake timer; real progress text takes over.
                const timerEl = document.getElementById("progress-timer");
                if (timerEl) {
                  timerEl.textContent = "";
                  timerEl.style.display = "none";
                }
              }
              // Real progress
              const charCount = obj.char_count || accContent.length;
              const pct = Math.min(95, (charCount / ESTIMATED_TOTAL_CHARS) * 100);
              document.getElementById("progress-bar").style.width = pct + "%";
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              document.getElementById("progress-text").textContent =
                `Generating... ${charCount.toLocaleString()} chars · ${elapsed}s`;
            }
          } catch (e) {
            console.warn("[Classwork Studio] Bad SSE chunk:", dataStr);
          }
        } else if (eventName === "done") {
          try {
            finalMeta = JSON.parse(dataStr);
          } catch (e) {
            console.warn("[Classwork Studio] Bad SSE done:", dataStr);
          }
        } else if (eventName === "error") {
          try {
            const obj = JSON.parse(dataStr);
            showError(obj.error || "Generation failed. Please try again.");
            errored = true;
          } catch (e) {
            showError("Generation failed. Please try again.");
            errored = true;
          }
        }
      }
    }

    if (errored) {
      clearInterval(progressInterval);
      const timerEl3 = document.getElementById("progress-timer");
      if (timerEl3) { timerEl3.textContent = ""; timerEl3.style.display = "none"; }
      showProgress(false);
      return;
    }

    // Finalize: render full markdown ONCE (replaces the plain-text preview)
    const finalContent = (finalMeta && finalMeta.content) || accContent;
    currentMarkdown = finalContent;
    output.innerHTML = renderWorksheet(finalContent);
    renderMath();

    const elapsedFinal = ((Date.now() - startTime) / 1000).toFixed(2);
    const tokens = (finalMeta && finalMeta.tokens) || {};
    const finishReason = (finalMeta && finalMeta.finish_reason) || 'unknown';
    const finishReasonLabel = {
      'stop': 'Done',
      'length': 'Truncated',
      'content_filter': 'Filtered',
      'unknown': 'Unknown'
    }[finishReason] || finishReason;

    statsBar.innerHTML = `
      <span><span class="label">Time</span><span class="value">${elapsedFinal}s</span></span>
      <span><span class="label">Input</span><span class="value">${tokens.prompt || 0}</span></span>
      <span><span class="label">Output</span><span class="value">${tokens.completion || 0}</span></span>
      <span><span class="label">Total</span><span class="value">${tokens.total || 0}</span></span>
      <span><span class="label">Status</span><span class="value">${finishReasonLabel}</span></span>
    `;

    clearInterval(progressInterval);
    document.getElementById("progress-bar").style.width = "100%";
    // Reset the fake timer span so it doesn't sit there looking stale.
    const timerElDone = document.getElementById("progress-timer");
    if (timerElDone) { timerElDone.textContent = ""; timerElDone.style.display = "none"; }
    document.getElementById("progress-text").textContent =
      `Done! ${finalContent.length.toLocaleString()} chars · ${elapsedFinal}s`;
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => showProgress(false), 2000);
  } catch (err) {
    if (err && err.name === "AbortError") {
      // Already handled by timeout handler
      return;
    }
    console.error("[Classwork Studio] Custom generation failed:", err);
    showError("Generation failed. Please try again.");
    clearInterval(progressInterval);
    // Also hide the fake timer
    const timerEl2 = document.getElementById("progress-timer");
    if (timerEl2) { timerEl2.textContent = ""; timerEl2.style.display = "none"; }
    showProgress(false);
  } finally {
    clearInterval(silenceCheckInterval);
    generateCustomBtn.disabled = false;
    generateCustomBtn.classList.remove("loading");
    generateCustomBtn.querySelector(".btn-text").textContent = "Generate Custom Worksheet";
    updateWeightSummary(); // re-evaluate the button's enabled state
  }
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (e) {
    console.warn('Logout fetch failed, proceeding with redirect');
  }
  window.location.href = '/login';
}

function handleUnauthorized() {
  showError('Session expired. Please log in again.');
  setTimeout(() => {
    window.location.href = '/login';
  }, 2000);
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkForRecentTasks();
});

async function checkForRecentTasks() {
  try {
    const response = await fetch('/api/tasks', { credentials: 'include' });
    if (response.status === 401) { return; }
    const data = await response.json();
    const tasks = data.tasks || [];
    
    const recentTasks = tasks.filter(t => {
      if (!t.created_at) return false;
      const ageHours = (Date.now() - t.created_at * 1000) / (1000 * 60 * 60);
      return ageHours < 24;
    });
    
    if (recentTasks.length > 0) {
      const banner = document.createElement('div');
      banner.className = 'task-banner';
      banner.innerHTML = `
        <span>📋 You have ${recentTasks.length} recent task${recentTasks.length > 1 ? 's' : ''}.</span>
        <button class="btn btn-primary btn-sm" onclick="toggleTaskList(); this.parentElement.remove();">View Tasks</button>
        <button class="btn btn-outline btn-sm" onclick="this.parentElement.remove();">Dismiss</button>
      `;
      document.querySelector('.app').insertBefore(banner, document.querySelector('.app-header').nextSibling);
    }
  } catch (e) {
    console.debug('Failed to check for recent tasks:', e);
  }
}

let taskListVisible = false;

async function toggleTaskList() {
  const section = document.getElementById('task-list-section');
  taskListVisible = !taskListVisible;
  
  if (taskListVisible) {
    section.classList.remove('hidden');
    await loadTaskList();
  } else {
    section.classList.add('hidden');
  }
}

async function loadTaskList() {
  try {
    console.log('[DEBUG] Loading task list...');
    const response = await fetch('/api/tasks', { credentials: 'include' });
    console.log('[DEBUG] Task list response:', response.status);
    if (response.status === 401) { handleUnauthorized(); return; }
    const data = await response.json();
    console.log('[DEBUG] Task list data:', data);
    const tasks = data.tasks || [];
    const container = document.getElementById('task-list-container');
    
    if (tasks.length === 0) {
      container.innerHTML = '<div class="task-empty">No tasks found. Your generation history will appear here.</div>';
      return;
    }
    
    container.innerHTML = `
      <table class="task-list">
        <thead>
          <tr>
            <th>Time</th>
            <th>Subject</th>
            <th>Difficulty</th>
            <th>VIEW</th>
            <th>DELETE</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(task => {
            const dateStr = task.created_at ? new Date(task.created_at * 1000).toLocaleString('en-HK') : '';
            const difficulty = task.level?.includes('Primary') ? 'Basic' : (task.level?.includes('Secondary') ? 'Advanced' : 'Unknown');
            
            return `
              <tr>
                <td class="task-time">${dateStr}</td>
                <td class="task-subject">${task.subject || 'Unknown'}</td>
                <td><span class="task-difficulty ${difficulty.toLowerCase()}">${difficulty}</span></td>
                <td><button class="task-btn" onclick="viewTask('${task.task_id}')">VIEW</button></td>
                <td><button class="task-btn task-btn-delete" onclick="deleteTask('${task.task_id}')">DELETE</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    console.error('Failed to load tasks:', e);
  }
}

async function viewTask(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, { credentials: 'include' });
    if (response.status === 401) { handleUnauthorized(); return; }
    const task = await response.json();
    
    if (task.content) {
      currentMarkdown = task.content;
      output.innerHTML = renderWorksheet(task.content);
      renderMath();
      resultSection.hidden = false;
      resultSection.scrollIntoView({ behavior: 'smooth' });
      
      statsBar.innerHTML = `
        <span><span class="label">Time</span><span class="value">${task.elapsed || 0}s</span></span>
        <span><span class="label">Input</span><span class="value">${(task.tokens && task.tokens.prompt) || 0}</span></span>
        <span><span class="label">Output</span><span class="value">${(task.tokens && task.tokens.completion) || 0}</span></span>
        <span><span class="label">Total</span><span class="value">${(task.tokens && task.tokens.total) || 0}</span></span>
        <span><span class="label">Status</span><span class="value">${task.finish_reason || 'Done'}</span></span>
      `;
    }
  } catch (e) {
    console.error('Failed to view task:', e);
  }
}

async function resumeTask(taskId) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/resume`, { method: 'POST', credentials: 'include' });
    if (response.status === 401) { handleUnauthorized(); return; }
    const data = await response.json();
    
    if (data.status === 'completed') {
      currentMarkdown = data.content;
      output.innerHTML = renderWorksheet(data.content);
      renderMath();
      resultSection.hidden = false;
      resultSection.scrollIntoView({ behavior: 'smooth' });
      
      statsBar.innerHTML = `
        <span><span class="label">Time</span><span class="value">${data.time || 0}s</span></span>
        <span><span class="label">Input</span><span class="value">${(data.tokens && data.tokens.prompt) || 0}</span></span>
        <span><span class="label">Output</span><span class="value">${(data.tokens && data.tokens.completion) || 0}</span></span>
        <span><span class="label">Total</span><span class="value">${(data.tokens && data.tokens.total) || 0}</span></span>
        <span><span class="label">Status</span><span class="value">${data.finish_reason || 'Done'}</span></span>
      `;
    } else {
      showError(`Task is ${data.status}. Progress: ${data.progress || 0}%`);
    }
  } catch (e) {
    console.error('Failed to resume task:', e);
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE', credentials: 'include' });
    if (response.status === 401) { handleUnauthorized(); return; }
    await loadTaskList();
  } catch (e) {
    console.error('Failed to delete task:', e);
  }
}
