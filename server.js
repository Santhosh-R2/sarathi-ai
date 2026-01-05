const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const tutorialRoutes = require("./routes/tutorialRoutes");

dotenv.config();
connectDB();

const app = express();

app.use(cors()); 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use("/api/users", userRoutes);
app.use("/api/tutorials", tutorialRoutes);

app.get("/", (req, res) => {
    res.send("API is Digital Sarathi AI-Powered Digital Literacy Assistant...");
});

const PORT = process.env.PORT || 5001;

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(`Server running in development on port ${PORT}`);
    });
}

module.exports = app;