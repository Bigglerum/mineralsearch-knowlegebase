#!/bin/bash
# Monitor enrichment progress

BASH_ID="1be0fc"

echo "=== E-Rocks Enrichment Monitor ==="
echo "Monitoring bash process: $BASH_ID"
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
  # Clear previous output
  clear

  echo "=== E-Rocks Enrichment Progress ==="
  echo "Time: $(date '+%H:%M:%S')"
  echo ""

  # Get the latest output - filter for progress lines
  npx -y @anthropic/claude-code-cli bash-output $BASH_ID 2>/dev/null | tail -30

  # Check if process is still running
  if npx -y @anthropic/claude-code-cli bash-output $BASH_ID 2>&1 | grep -q "status.*completed"; then
    echo ""
    echo "✅ Process completed!"
    break
  fi

  # Wait before next check
  sleep 10
done
