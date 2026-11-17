import express from "express";
import { MongoClient, ObjectId } from "mongodb";
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
const userCollection = db.collection("user");

// Better Auth stores users in the `user` collection. Its `_id` is either the
// hex string id or an ObjectId depending on the adapter's id generation.
async function findOrganizer(organizerId) {
  if (typeof organizerId !== "string" || !organizerId) return null;

  try {
    const organizerData = await userCollection.findOne({ _id: organizerId });
    return organizerData;
  } catch (error) {
    console.log("error at the time to fetch organizer", err);
    return null;
  }
}

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Social Events API is running!",
  });
});

// Add a new event
app.post("/events", async (req, res) => {
  try {
    const newEvent = { ...req.body, volunteerCount: 0 };
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

// Fetch all upcoming events, soonest first
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

//get Individual event details
app.get("/events/:id", async (req, res) => {
  try {
    const Id = req.params.id;

    if (!ObjectId.isValid(Id)) {
      return res.status(400).json({
        message: "Invalid event id.",
      });
    }

    const event = await eventCollection.findOne({ _id: new ObjectId(Id) });

    if (!event) {
      return res.status(404).json({
        message: "Event not found.",
      });
    }

    res.status(200).json(event);
  } catch (error) {
    console.error("Error fetching event:", error);

    res.status(500).json({
      message: "Failed to fetch events.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
