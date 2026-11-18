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
const joinedEventCollection = db.collection("joinedEvent");

//create indext
// Create unique index once during server startup
await joinedEventCollection.createIndex(
  { eventId: 1, participantId: 1 },
  { unique: true },
);

// Better Auth stores users in the `user` collection. Its `_id` is either the
// hex string id or an ObjectId depending on the adapter's id generation.
async function findOrganizer(organizerId) {
  if (typeof organizerId !== "string" || !organizerId) return null;

  try {
    const organizerData = await userCollection.findOne({ _id: organizerId });
    return organizerData;
  } catch (error) {
    console.log("error at the time to fetch organizer", error);
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
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
    }).format(new Date());

    const events = await eventCollection
      .find({ date: { $gte: today } })
      .sort({ date: 1 })
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

//update a event
app.put("/events/:id", async (req, res) => {
  try {
    const Id = req.params.id;

    if (!ObjectId.isValid(Id)) {
      return res.status(400).json({
        message: "Invalid event id.",
      });
    }

    // Never let the client overwrite the id or the live volunteer count.
    const { _id, volunteerCount, ...updates } = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No event fields to update.",
      });
    }

    const result = await eventCollection.updateOne(
      { _id: new ObjectId(Id) },
      { $set: updates },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Event not found.",
      });
    } else {
      await joinedEventCollection.updateMany(
        { eventId: new ObjectId(Id) },
        { $set: updates },
      );
    }

    return res.status(200).json({
      message: "Event updated successfully.",
    });
  } catch (err) {
    console.log("error for event update", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

//delete a event
app.delete("/events/:id", async (req, res) => {
  try {
    const Id = req.params.id;

    if (!ObjectId.isValid(Id)) {
      return res.status(400).json({
        message: "Invalid event id.",
      });
    }
    const result = await eventCollection.deleteOne({ _id: new ObjectId(Id) });

    if (result.deletedCount >= 1) {
      await joinedEventCollection.deleteMany({ eventId: new ObjectId(Id) });
    }

    return res.status(200).json({
      message: "Event deleted successfully.",
    });
  } catch (err) {
    console.log("error for event deletion");
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

//add a joined to a event
app.post("/joinedEvent", async (req, res) => {
  try {
    const {
      eventId: id,
      participantId,
      participantName,
      participantEmail,
    } = req.body;

    if (!id || !participantId) {
      return res.status(400).json({
        message: "Event id and participant id are required.",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid event id.",
      });
    }

    const eventId = new ObjectId(id);

    // 1. Find the event
    const event = await eventCollection.findOne({
      _id: eventId,
    });

    if (!event) {
      return res.status(404).json({
        message: "Event not found.",
      });
    }

    // 2. Check whether the participant already joined
    const alreadyJoined = await joinedEventCollection.findOne({
      eventId,
      participantId,
    });

    if (alreadyJoined) {
      return res.status(409).json({
        code: "ALREADY_JOINED",
        message: "You have already joined this event.",
      });
    }

    // 3. Check volunteer capacity
    const volunteerCount = event.volunteerCount || 0;

    if (volunteerCount >= event.numberOfVolunteers) {
      return res.status(409).json({
        code: "EVENT_FULL",
        message: "Sorry, this event has reached its volunteer limit.",
      });
    }

    // 4. Reserve a slot atomically so concurrent joins cannot overbook
    const updatedEvent = await eventCollection.findOneAndUpdate(
      {
        _id: eventId,
        $expr: {
          $lt: [{ $ifNull: ["$volunteerCount", 0] }, "$numberOfVolunteers"],
        },
      },
      { $inc: { volunteerCount: 1 } },
      { returnDocument: "after" },
    );

    if (!updatedEvent) {
      return res.status(409).json({
        code: "EVENT_FULL",
        message: "Sorry, this event has reached its volunteer limit.",
      });
    }

    // 5. Insert participant information, releasing the reserved slot on failure
    const newJoinedEvent = {
      eventId,
      participantId,
      participantName,
      participantEmail,
      joinedAt: new Date(),
    };

    try {
      await joinedEventCollection.insertOne(newJoinedEvent);
    } catch (error) {
      await eventCollection.updateOne(
        { _id: eventId },
        { $inc: { volunteerCount: -1 } },
      );
      throw error;
    }

    // 6. Success response
    res.status(201).json({
      message: "Joined event successfully.",
      volunteerCount: updatedEvent.volunteerCount,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        code: "ALREADY_JOINED",
        message: "You have already joined this event.",
      });
    }

    console.error("Error joining event:", error);

    res.status(500).json({
      message: "Failed to join event.",
    });
  }
});

//get joined events for a participant
app.post("/joinedEvent/list", async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({
        message: "Participant id is required.",
      });
    }

    const joinedEvents = await joinedEventCollection
      .find({ participantId })
      .toArray();

    res.status(200).json(joinedEvents);
  } catch (error) {
    console.error("Error fetching joined events:", error);

    res.status(500).json({
      message: "Failed to fetch joined events.",
    });
  }
});

//leave a joined event (removes the participant's join row, not the event)
app.delete("/joinedEvent/:id", async (req, res) => {
  try {
    const Id = req.params.id;

    if (!ObjectId.isValid(Id)) {
      return res.status(400).json({
        message: "Invalid event id.",
      });
    }

    const result = await joinedEventCollection.findOneAndDelete({
      _id: new ObjectId(Id),
    });

    if (result) {
      const { eventId } = result;
      // Give the reserved volunteer slot back, but never below zero.
      await eventCollection.updateOne(
        { _id: new ObjectId(eventId), volunteerCount: { $gt: 0 } },
        { $inc: { volunteerCount: -1 } },
      );
    } else {
      return res.status(404).json({
        message: "Event not found or already deleted.",
      });
    }

    return res.status(200).json({
      message: "Left event successfully.",
    });
  } catch (err) {
    console.log("error for leaving event", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

//get organized events for a organizer
app.get("/joinedEvent/list/:organizerId", async (req, res) => {
  try {
    const { organizerId } = req.params;

    if (!organizerId) {
      return res.status(400).json({
        message: "Participant id is required.",
      });
    }

    const events = await eventCollection.find({ organizerId }).toArray();

    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching joined events:", error);

    res.status(500).json({
      message: "Failed to fetch joined events.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
