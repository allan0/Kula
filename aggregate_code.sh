#!/bin/bash

# =============================================================================
# KULA Project - Lightweight Code Aggregator
# Skips lock files, build artifacts, and massive files.
# =============================================================================

OUTPUT_FILE="${1:-kula_all_code.txt}"
PROJECT_ROOT="$(pwd)"

# Maximum file size to include (100KB) - prevents including binaries/minified logs
MAX_SIZE=102400

echo "🔍 Aggregating RELEVANT KULA code into: $OUTPUT_FILE"
echo "Project root: $PROJECT_ROOT"

# Clear output file
> "$OUTPUT_FILE"

append_file() {
    local file="$1"
    
    # Check if file exists and is a regular file
    [ -f "$file" ] || return
    
    # Skip lock files explicitly
    [[ "$file" == *"package-lock.json"* ]] && return
    [[ "$file" == *"yarn.lock"* ]] && return
    [[ "$file" == *"pnpm-lock.yaml"* ]] && return

    # Skip files larger than MAX_SIZE
    local filesize=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    if [ "$filesize" -gt "$MAX_SIZE" ]; then
        echo "   ⚠️ Skipping large file: $file ($(du -h "$file" | cut -f1))"
        return
    fi

    echo "=================================================================" >> "$OUTPUT_FILE"
    echo "FILE: ${file#$PROJECT_ROOT/}" >> "$OUTPUT_FILE"
    echo "=================================================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# 1. Essential Configs
echo "📦 Processing config files..."
for f in package.json hardhat.config.js README.md next.config.js tailwind.config.js tsconfig.json; do
    [ -f "$f" ] && append_file "$f"
done

# 2. Smart Find: Define directories and patterns
# Excludes: node_modules, artifacts, cache, .next, .expo, build, dist
echo "📄 Processing source code (contracts, scripts, tests, web, mobile)..."
find . -type f \
    \( -name "*.sol" -o -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.sh" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/artifacts/*" \
    -not -path "*/cache/*" \
    -not -path "*/build/*" \
    -not -path "*/dist/*" \
    -not -path "*/.next/*" \
    -not -path "*/.expo/*" \
    -not -path "*/.git/*" \
    | sort | while read -r file; do
    append_file "$file"
done

# 3. Handle USSD/Frontend JSON configs (carefully)
echo "⚙️ Processing specific JSON configs..."
find . -type f -name "*.json" \
    -not -path "*/node_modules/*" \
    -not -path "*/artifacts/*" \
    -not -name "package-lock.json" \
    -not -name "package.json" \
    -not -path "*/.next/*" \
    | sort | while read -r file; do
    append_file "$file"
done

echo ""
echo "✅ Done! All relevant code aggregated into: $OUTPUT_FILE"
echo "Total size: $(du -h "$OUTPUT_FILE" | cut -f1)"
