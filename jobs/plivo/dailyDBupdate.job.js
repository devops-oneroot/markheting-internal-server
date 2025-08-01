import fetch from "node-fetch";

const url = "https://dashboard-server.markhet.app/update-database";
fetch(url)
  .then((response) => {
    if (response.ok) {
      console.log("GET request successful.");
    } else {
      console.log(`GET request failed. Status: ${response.status}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error during GET request:", error);
    process.exit(1);
  });
