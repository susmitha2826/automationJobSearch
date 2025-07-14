import { runJobSearch } from "./jobSearch.mjs";

runJobSearch().then(() => {
  console.log("Test run complete");
  process.exit(0);
}).catch(err => {
  console.error("Test run error:", err);
  process.exit(1);
});
