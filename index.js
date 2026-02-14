import "dotenv/config";
import { app } from "./server.js";
import { connectDb } from "./config/db.js";

const { PORT } = process.env;

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => console.log(err));
