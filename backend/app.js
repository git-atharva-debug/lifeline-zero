const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);
const dotenv = require("dotenv");
dotenv.config(); // Must be FIRST — before any require() that reads process.env

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { verifyCloudinary } = require("./config/cloudinary");
const bottleneckRoutes = require("./routes/bottleneckRoutes");
const emergencyFundRoutes = require("./routes/emergencyFundRoutes");

connectDB();
verifyCloudinary();

const app = express();

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001"
    ];
    if (process.env.CORS_ORIGIN) {
      allowedOrigins.push(process.env.CORS_ORIGIN);
    }
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Routes (ALL ROUTES MUST BE HERE)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/preparedness", require("./routes/preparednessRoutes"));
app.use("/api/incidents", require("./routes/incidentRoutes"));
app.use("/api/maps", require("./routes/mapRoutes"));
app.use("/api/phantom", require("./routes/phantomRoutes"));
app.use("/api/whatif", require("./routes/whatIfRoutes"));
app.use("/api/bottleneck", bottleneckRoutes);
app.use("/api/broadcasts", require("./routes/broadcastRoutes"));
app.use("/api/sos", require("./routes/sosRoutes"));
app.use("/api/emergency-fund", emergencyFundRoutes);

app.use("/api/resources", require("./routes/resourceRoutes"));

// Health
app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});

app.get("/", (req, res) => {
  res.send("Rescue.AI Backend Running 🚀");
});

// ❗ 404 handler MUST be last
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});


// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(`✓ Server running on http://localhost:${PORT}`)
);
