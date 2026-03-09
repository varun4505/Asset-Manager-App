import app from "./app";
import { storageMode } from "./storage";

const log = console.log;
const port = parseInt(process.env.PORT || "5000", 10);

app.listen(port, "0.0.0.0", () => {
  log(`express server serving on port ${port}`);
  log(`storage backend: ${storageMode}`);
});
