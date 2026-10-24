/*
  BME Attendance Tracker
  Features:
  1. Student name and roll number
  2. Take a photo using the camera
  3. Detect identical or similar photos
  4. Prevent duplicate roll-number submissions
  5. View attendance and save it as a PDF

  Note: This demo saves records in the current browser only.
  Photo similarity is NOT AI facial recognition.
*/

const generateButton = document.getElementById("generateButton");
const attendanceButton = document.getElementById("attendenceSheetButton");
const card = document.querySelector(".codeGenerater");

const STORAGE_KEY = "bmeAttendanceRecordsV1";

let cameraStream = null;
let capturedPhoto = null;

// Get attendance records from browser storage
function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

// Save attendance records
function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (error) {
    alert("Unable to save attendance. Browser storage may be full.");
    return false;
  }
}

// Prevent HTML entered by users from being interpreted as markup
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

// Stop camera when no longer needed
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
}

// Show the student attendance form
function showForm() {
  stopCamera();
  capturedPhoto = null;

  card.innerHTML = `
    <section style="width:90%;max-width:420px;padding:20px;
                    box-sizing:border-box;text-align:left;
                    font-family:Arial,sans-serif">

      <h2>Mark Attendance</h2>
      <p>Enter your details and take a photo.</p>

      <form id="studentForm">

        <label for="studentName">Full name</label>
        <input id="studentName" required maxlength="80"
          style="display:block;width:100%;box-sizing:border-box;
                 padding:10px;margin:6px 0 14px">

        <label for="rollNumber">Roll number</label>
        <input id="rollNumber" required maxlength="30"
          style="display:block;width:100%;box-sizing:border-box;
                 padding:10px;margin:6px 0 14px">

        <video id="camera" autoplay playsinline muted
          style="display:none;width:100%;border-radius:10px"></video>

        <canvas id="canvas" style="display:none"></canvas>

        <img id="photoPreview" alt="Captured photo"
          style="display:none;width:100%;border-radius:10px">

        <div style="margin:12px 0">
          <button type="button" id="openCamera">
            Open Camera
          </button>

          <button type="button" id="takePhoto" disabled>
            Take Photo
          </button>

          <button type="button" id="retakePhoto" hidden>
            Retake Photo
          </button>
        </div>

        <p id="message" role="status">
          Allow camera access when your browser asks.
        </p>

        <button type="submit" id="submitAttendance" disabled>
          Submit Attendance
        </button>

        <button type="button" id="backButton">
          Back
        </button>
      </form>
    </section>
  `;

  const form = document.getElementById("studentForm");
  const video = document.getElementById("camera");
  const canvas = document.getElementById("canvas");
  const preview = document.getElementById("photoPreview");
  const message = document.getElementById("message");
  const takeButton = document.getElementById("takePhoto");
  const submitButton = document.getElementById("submitAttendance");

  // Open camera
  document.getElementById("openCamera").onclick = async () => {
    try {
      stopCamera();

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      video.srcObject = cameraStream;
      video.style.display = "block";
      preview.style.display = "none";
      takeButton.disabled = false;
      message.textContent = "Camera ready. Take your photo.";
    } catch (error) {
      message.textContent =
        "Camera unavailable. Allow permission and use localhost or HTTPS.";
    }
  };

  // Capture photo
  takeButton.onclick = () => {
    if (!cameraStream || !video.videoWidth) {
      message.textContent = "Wait for the camera to load.";
      return;
    }

    const scale = Math.min(
      1,
      480 / Math.max(video.videoWidth, video.videoHeight),
    );

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    capturedPhoto = canvas.toDataURL("image/jpeg", 0.72);
    preview.src = capturedPhoto;
    preview.style.display = "block";
    video.style.display = "none";

    stopCamera();

    takeButton.style.display = "none";
    document.getElementById("retakePhoto").hidden = false;
    submitButton.disabled = false;
    message.textContent = "Photo captured. You can now submit.";
  };

  // Retake photo
  document.getElementById("retakePhoto").onclick = () => {
    capturedPhoto = null;
    preview.style.display = "none";
    takeButton.style.display = "inline-block";
    document.getElementById("retakePhoto").hidden = true;
    submitButton.disabled = true;
    document.getElementById("openCamera").click();
  };

  // Submit attendance
  form.onsubmit = async (event) => {
    event.preventDefault();

    const name = document.getElementById("studentName").value.trim();
    const roll = document
      .getElementById("rollNumber")
      .value.trim()
      .toUpperCase();

    if (!name || !roll || !capturedPhoto) {
      message.textContent = "Enter your details and take a photo first.";
      return;
    }

    const records = getRecords();

    if (
      records.some((record) => record.roll.toLowerCase() === roll.toLowerCase())
    ) {
      message.textContent =
        "This roll number has already submitted attendance.";
      return;
    }

    submitButton.disabled = true;
    message.textContent = "Checking photo...";

    try {
      const hash = await photoHash(capturedPhoto);

      const duplicate = records.some(
        (record) =>
          record.photoHash && hashDistance(hash, record.photoHash) <= 5,
      );

      if (duplicate) {
        message.textContent =
          "Possible duplicate photo detected. Attendance was not recorded. Ask your teacher to review it.";
        submitButton.disabled = false;
        return;
      }

      records.push({
        name,
        roll,
        timestamp: new Date().toISOString(),
        status: "Present",
        photoHash: hash,
      });

      if (!saveRecords(records)) {
        submitButton.disabled = false;
        return;
      }

      stopCamera();

      card.innerHTML = `
        <div style="padding:25px;text-align:center">
          <h2>✓ Attendance Submitted!</h2>
          <p>Name: ${escapeHTML(name)}</p>
          <p>Roll number: ${escapeHTML(roll)}</p>
          <p>Your record was saved in this browser.</p>
          <button id="homeButton">Back to Home</button>
        </div>
      `;

      document.getElementById("homeButton").onclick = showHome;
    } catch (error) {
      message.textContent = "Could not check photo. Please try again.";
      submitButton.disabled = false;
    }
  };

  document.getElementById("backButton").onclick = showHome;
}

// Create a simple perceptual image hash.
// This checks image similarity, NOT whether two images show the same person.
function photoHash(dataURL) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 9;
      canvas.height = 8;

      const context = canvas.getContext("2d", {
        willReadFrequently: true,
      });

      context.drawImage(image, 0, 0, 9, 8);

      const pixels = context.getImageData(0, 0, 9, 8).data;
      let hash = "";

      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const left = (y * 9 + x) * 4;
          const right = (y * 9 + x + 1) * 4;

          const grayLeft =
            pixels[left] * 0.299 +
            pixels[left + 1] * 0.587 +
            pixels[left + 2] * 0.114;

          const grayRight =
            pixels[right] * 0.299 +
            pixels[right + 1] * 0.587 +
            pixels[right + 2] * 0.114;

          hash += grayLeft > grayRight ? "1" : "0";
        }
      }

      resolve(hash);
    };

    image.onerror = () => reject(new Error("Photo could not be processed."));
    image.src = dataURL;
  });
}

// Count differing bits between image hashes
function hashDistance(a, b) {
  let distance = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) distance++;
  }

  return distance + Math.abs(a.length - b.length);
}

// Return to the home page
function showHome() {
  stopCamera();

  card.innerHTML = `
    <button id="generateButton">GENERATE YOUR CODE</button>
  `;

  document.getElementById("generateButton").onclick = showForm;
}

// Open attendance sheet in a separate tab
function showAttendanceSheet() {
  const records = getRecords();
  const report = window.open("", "_blank");

  if (!report) {
    alert("Popup blocked. Allow popups and try again.");
    return;
  }

  const rows = records
    .map(
      (record, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHTML(record.roll)}</td>
      <td>${escapeHTML(record.name)}</td>
      <td>${escapeHTML(new Date(record.timestamp).toLocaleString())}</td>
      <td>${escapeHTML(record.status)}</td>
    </tr>
  `,
    )
    .join("");

  report.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Attendance Sheet</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 25px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #aaa; padding: 9px; text-align: left; }
        th { background: #eee; }
        button { padding: 10px 16px; margin: 12px 0; cursor: pointer; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <h1>Attendance Sheet</h1>
      <p>Total present: ${records.length}</p>
      <button onclick="window.print()">Print / Save as PDF</button>
      ${
        records.length
          ? `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Roll Number</th>
              <th>Name</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `
          : "<p>No attendance records yet.</p>"
      }
    </body>
    </html>
  `);

  report.document.close();
}

// Connect the buttons from your existing HTML
generateButton.addEventListener("click", showForm);
attendanceButton.addEventListener("click", showAttendanceSheet);
