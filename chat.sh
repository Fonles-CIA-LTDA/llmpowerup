#!/bin/bash
# ============================================
#  LLMPowerUp Interactive Chat
#  Rust backend + 42 tools + OpenRouter
# ============================================

API="http://localhost:3001"
KEY="clst_test_abc123xyz789def456ghi"
MODEL="google/gemma-4-31b-it"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}⚡ LLMPowerUp Agent — 42 tools${NC}"
echo -e "${GRAY}Model: $MODEL | Backend: $API${NC}"
echo -e "${GRAY}Type your message. Ctrl+C to exit.${NC}"
echo ""

while true; do
    echo -ne "${BLUE}You: ${NC}"
    read -r INPUT
    [ -z "$INPUT" ] && continue

    echo -e "${GRAY}Thinking...${NC}"

    # Escape the input for JSON
    ESCAPED=$(echo "$INPUT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))")

    RESPONSE=$(curl -s -m 120 "$API/v1/agent/run" \
        -H "Authorization: Bearer $KEY" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"$MODEL\",\"content\":$ESCAPED,\"max_tokens\":4000}" 2>&1)

    # Parse SSE events
    echo ""
    HAS_TOOLS=false

    while IFS= read -r line; do
        # Skip heartbeats and empty lines
        [[ "$line" == ": "* ]] && continue
        [[ -z "$line" ]] && continue

        if [[ "$line" == "event: tool_start" ]]; then
            HAS_TOOLS=true
        elif [[ "$line" == "data: "* ]]; then
            DATA="${line#data: }"

            # Parse with python
            PARSED=$(echo "$DATA" | python3 -c "
import sys,json
try:
    d=json.loads(sys.stdin.read())
    if 'tool_name' in d and 'result' not in d:
        print(f'TOOL_START|{d[\"tool_name\"]}')
    elif 'tool_name' in d and 'result' in d:
        err='ERROR ' if d.get('is_error') else ''
        print(f'TOOL_END|{d[\"tool_name\"]}|{err}{d[\"result\"][:500]}')
    elif 'stop_reason' in d:
        print(f'DONE|{d[\"stop_reason\"]}')
    elif 'message' in d:
        print(f'STATUS|{d[\"message\"]}')
    else:
        print(f'OTHER|{json.dumps(d)[:200]}')
except: pass
" 2>/dev/null)

            IFS='|' read -r TYPE ARG1 ARG2 <<< "$PARSED"

            case "$TYPE" in
                TOOL_START)
                    echo -e "  ${YELLOW}🔧 $ARG1${NC} ${GRAY}running...${NC}"
                    ;;
                TOOL_END)
                    echo -e "  ${GREEN}✅ $ARG1${NC}"
                    if [ -n "$ARG2" ]; then
                        # Show result indented, max 5 lines
                        echo "$ARG2" | head -5 | while IFS= read -r rline; do
                            echo -e "     ${GRAY}$rline${NC}"
                        done
                        LINES=$(echo "$ARG2" | wc -l)
                        [ "$LINES" -gt 5 ] && echo -e "     ${GRAY}... (+$((LINES-5)) more lines)${NC}"
                    fi
                    ;;
                DONE)
                    ;;
                STATUS)
                    ;;
            esac
        fi
    done <<< "$RESPONSE"

    # If there were tools, show separator
    $HAS_TOOLS && echo ""

    echo -e "${GREEN}${BOLD}Assistant:${NC} ${GRAY}(response via LLMPowerUp engine)${NC}"
    echo ""
done
