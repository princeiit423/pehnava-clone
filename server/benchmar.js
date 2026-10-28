
//const autocannon = require("autocannon");
import autocannon from "autocannon";
const URL = "http://localhost:5000/api/homepage-content";

const stages = [10, 25, 50, 100];
const results = [];

function runTest(connections) {
  return new Promise((resolve, reject) => {
    console.log(`Testing ${connections} connections...`);

    autocannon(
      {
        url: URL,
        connections,
        duration: 30,
        pipelining: 1,
        timeout: 10,
      },
      (err, result) => {
        if (err) return reject(err);

        results.push({
          Connections: connections,
          "Req/sec": result.requests.average.toFixed(2),
          "Avg Latency": result.latency.average.toFixed(2) + " ms",
          "P50 Latency": result.latency.p50 + " ms",
          "P95 Latency": result.latency.p95 + " ms",
          "P99 Latency": result.latency.p99 + " ms",
          "Throughput": (result.throughput / 1024).toFixed(2) + " KB/s",
          "HTTP Errors": result.non2xx,
          "Socket Errors": result.errors,
          "Timeouts": result.timeouts,
        });

        resolve();
      }
    );
  });
}

async function main() {
  console.log("\n=== EXPRESS BACKEND LOAD TEST ===");
  console.log("Target:", URL);
  console.log("Duration: 30 seconds per stage\n");

  for (const connections of stages) {
    await runTest(connections);

    // Stop increasing load if errors or timeouts occur.
    const last = results[results.length - 1];

    if (
      last["HTTP Errors"] > 0 ||
      last["Socket Errors"] > 0 ||
      last["Timeouts"] > 0
    ) {
      console.log("\nStopping: errors detected at this load level.");
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.log("\n=== FINAL BENCHMARK REPORT ===\n");
  console.table(results);
}

main().catch(console.error);
