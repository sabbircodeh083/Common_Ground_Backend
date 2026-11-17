import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import "dotenv/config";

const PORT = process.env.PORT || 8000;
const app = express();

//cros config. todo use frontend url in {origin: "frontend url"}
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//confugure database
const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db("CommonGround");

//create collections
const eventCollection = db.collection("events");

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Social Events API is running!",
  });
});

// Add a new event
app.post("/events", async (req, res) => {
  try {
    const newEvent = req.body;
    const result = await eventCollection.insertOne(newEvent);

    res.status(201).json({
      message: "Event added successfully.",
    });
  } catch (error) {
    console.error("Error adding event:", error);

    res.status(500).json({
      message: "Failed to add event.",
    });
  }
});

// Fetch all events, soonest first
app.get("/events", async (req, res) => {
  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(new Date());

    const events = await eventCollection
      .find({ date: { $gte: today } })
      .sort({ date: 1 })
      .toArray();

    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching events:", error);

    res.status(500).json({
      message: "Failed to fetch events.",
    });
  }
});

//fetch 6 upcoming events
app.get("/events-recent6", async (req, res) => {
  try {
    const events = await eventCollection
      .find()
      .sort({ date: -1 })
      .limit(6)
      .toArray();

    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching recent events:", error);

    res.status(500).json({
      message: "Failed to fetch recent events.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
