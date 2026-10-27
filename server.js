const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: log every request so server activity is visible in the terminal.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Optional report photo upload. Only image files up to 5 MB are accepted.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeOriginalName}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed."));
  }
});

// Serve the original UI and CSS plus the JavaScript file added for backend integration.
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

// Temporary demonstration data; no database is connected.
const collectionPoints = [
  {
    id: 1,
    name: "Community Recycling Center",
    icon: "♻️",
    wasteTypes: "Dry waste • Paper • Plastic • Metal",
    hours: "9:00 AM – 6:00 PM",
    search: "community recycling center dry plastic paper"
  },
  {
    id: 2,
    name: "E-Waste Collection Point",
    icon: "🔋",
    wasteTypes: "Electronics • Batteries • E-waste",
    hours: "10:00 AM – 5:00 PM",
    search: "e waste collection batteries electronics hazardous"
  },
  {
    id: 3,
    name: "Plastic Collection Point",
    icon: "🥤",
    wasteTypes: "Clean plastic packaging • Bottles",
    hours: "8:00 AM – 7:00 PM",
    search: "plastic collection dry recyclable"
  }
];

let reports = [];
let nextReportId = 1;

// Basic status endpoint.
app.get("/api/status", (req, res) => {
  res.json({
    status: "success",
    message: "EcoCity backend is running.",
    database: "Not connected; demo data is stored in server memory."
  });
});

// READ collection point records.
app.get("/api/collection-points", (req, res) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  const result = search
    ? collectionPoints.filter(point =>
        `${point.name} ${point.wasteTypes} ${point.search}`.toLowerCase().includes(search)
      )
    : collectionPoints;

  res.json({ status: "success", count: result.length, data: result });
});

// READ project dashboard stats. These are demo values, not live municipal figures.
app.get("/api/stats", (req, res) => {
  res.json({
    status: "success",
    data: {
      demoReports: 1250 + reports.length,
      issuesResolved: 850,
      recyclingActions: 620,
      awarenessGoalPercent: 75,
      submittedReports: reports.length,
      note: "Demonstration statistics only; not live municipal data."
    }
  });
});

// CREATE a citizen waste report. Data is temporary unless a database is added.
app.post("/api/reports", upload.single("photo"), (req, res) => {
  const { name, email, location, wasteType, description } = req.body;

  if (!name || !email || !location || !wasteType || !description) {
    return res.status(400).json({
      status: "error",
      message: "Please complete all required fields."
    });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ status: "error", message: "Please provide a valid email address." });
  }

  const report = {
    id: nextReportId++,
    name: String(name).trim(),
    email: String(email).trim(),
    location: String(location).trim(),
    wasteType: String(wasteType).trim(),
    description: String(description).trim(),
    photo: req.file ? `/uploads/${req.file.filename}` : null,
    status: "Received",
    createdAt: new Date().toISOString()
  };

  reports.push(report);
  res.status(201).json({
    status: "success",
    message: "Your waste report was submitted successfully.",
    data: report
  });
});

// READ all submitted reports (useful for API demonstration / Postman).
app.get("/api/reports", (req, res) => {
  res.json({ status: "success", count: reports.length, data: reports });
});

// READ one report by ID.
app.get("/api/reports/:id", (req, res) => {
  const report = reports.find(item => item.id === Number(req.params.id));
  if (!report) {
    return res.status(404).json({ status: "error", message: "Report not found." });
  }
  res.json({ status: "success", data: report });
});

// UPDATE a report's status.
app.patch("/api/reports/:id/status", (req, res) => {
  const report = reports.find(item => item.id === Number(req.params.id));
  if (!report) {
    return res.status(404).json({ status: "error", message: "Report not found." });
  }

  const allowedStatuses = ["Received", "In progress", "Resolved"];
  if (!allowedStatuses.includes(req.body.status)) {
    return res.status(400).json({
      status: "error",
      message: `Status must be one of: ${allowedStatuses.join(", ")}.`
    });
  }

  report.status = req.body.status;
  res.json({ status: "success", message: "Report status updated.", data: report });
});

// DELETE a report by ID.
app.delete("/api/reports/:id", (req, res) => {
  const index = reports.findIndex(item => item.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ status: "error", message: "Report not found." });
  }

  const deleted = reports.splice(index, 1)[0];
  res.json({ status: "success", message: "Report deleted.", data: deleted });
});

// Unknown API paths return JSON instead of the HTML page.
app.use("/api", (req, res) => {
  res.status(404).json({ status: "error", message: "API endpoint not found." });
});

// Handle upload errors and unexpected errors with clear JSON responses.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "Image must be 5 MB or smaller."
      : err.message;
    return res.status(400).json({ status: "error", message });
  }
  if (err) {
    return res.status(400).json({ status: "error", message: err.message || "Request failed." });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`EcoCity server is running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
