// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory fallback storage (used when MongoDB not connected)
let inMemoryItems = [];

// MongoDB connection (optional)
let dbConnected = false;
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI provided — running in-memory fallback mode.");
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
    dbConnected = true;
  } catch (err) {
    console.error("MongoDB error:", err.message);
    console.log("Continuing in in-memory fallback mode.");
  }
}
connectDB();

// If DB connected, use a model; otherwise in-memory list used
const ItemSchema = new mongoose.Schema({
  name: String,
  price: Number,
});
const ItemModel = mongoose.models.Item || mongoose.model("Item", ItemSchema);

// Health endpoint
app.get("/status", (req, res) => {
  res.json({ status: "OK", message: "Backend running", dbConnected });
});

// GET items - uses DB if available, otherwise in-memory
app.get("/api/items", async (req, res) => {
  try {
    if (dbConnected && mongoose.connection.readyState === 1) {
      const items = await ItemModel.find().limit(100).lean();
      return res.json(items);
    }
    // fallback
    return res.json(inMemoryItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST item - uses DB if available, otherwise in-memory
app.post("/api/items", async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: "name and price required" });

    if (dbConnected && mongoose.connection.readyState === 1) {
      const it = new ItemModel({ name, price });
      await it.save();
      return res.status(201).json(it);
    }

    // Fallback: add to in-memory array and return created item
    const id = (inMemoryItems.length + 1).toString();
    const item = { _id: id, name, price };
    inMemoryItems.push(item);
    return res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Contact endpoint
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "name, email and message are required" });
  res.json({ success: true, name, email, message });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(port, () => console.log(`Server started on http://localhost:${port}`));
