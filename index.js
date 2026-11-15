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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
