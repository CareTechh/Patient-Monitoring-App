// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const port = process.env.PORT || 3000;

const corsOptions = process.env.ALLOWED_ORIGIN
  ? { origin: process.env.ALLOWED_ORIGIN }
  : {};
app.use(cors(corsOptions));
app.use(express.json());

async function tryConnectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI provided — skipping DB connection.");
    return;
  }
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
  }
}
tryConnectMongo();

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.models.Item || mongoose.model("Item", ItemSchema);

app.get("/status", (req, res) => res.json({ status: "OK", message: "Backend running" }));

app.get("/api/items", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const items = await Item.find().limit(50).lean();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/items", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: "Database not available" });
    const { name, price } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: "name and price are required" });
    const it = new Item({ name, price });
    await it.save();
    res.status(201).json(it);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Could not create item" });
  }
});

app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "name, email and message are required" });
  res.json({ success: true, name, email, message });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(port, () => console.log(`Server started on http://localhost:${port}`));
