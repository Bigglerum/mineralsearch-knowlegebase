#!/bin/bash

# Progress monitor for Phase 1 enrichment
# This script continuously monitors the log file and displays progress

LOG_FILE="/tmp/phase1-enrichment.log"

echo "═══════════════════════════════════════════════════════════"
echo "  Phase 1 Enrichment - Progress Monitor"
echo "═══════════════════════════════════════════════════════════"
echo ""

while true; do
  # Get the latest progress line
  LATEST=$(tail -20 "$LOG_FILE" 2>/dev/null | grep "Progress:" | tail -1)

  if [ -n "$LATEST" ]; then
    # Clear the line and print progress
    echo -ne "\r$LATEST   [$(date '+%H:%M:%S')]   "
  else
    echo -ne "\rWaiting for progress updates...   [$(date '+%H:%M:%S')]   "
  fi

  # Check if completed
  if grep -q "✅ Processed all" "$LOG_FILE" 2>/dev/null; then
    echo ""
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  ENRICHMENT COMPLETE!"
    echo "═══════════════════════════════════════════════════════════"
    tail -30 "$LOG_FILE" | grep -E "(✅|📊|📄)"
    break
  fi

  sleep 2
done
