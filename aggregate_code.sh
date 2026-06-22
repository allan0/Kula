#!/bin/bash

# =============================================================================
# KULA Project - Comprehensive Code Aggregator
# Captures: Contracts, Frontend, Mobile, USSD Middleware, and SQL
# Excludes: Media, Binaries, Lock files, and Build folders
# =============================================================================

OUTPUT_FILE="${1:-kula_all_code.txt}"
PROJECT_ROOT="$(pwd)"

# Maximum file size (100KB) to prevent including large logs or minified files
MAX_SIZE=102400

echo "🔍 Aggregating KULA source code into: $OUTPUT_FILE"

# Clear/Create output file
> "$OUTPUT_FILE"

append_file() {
    local file="$1"
    
    # Check if file exists and is a regular file
    [ -f "$file" ] || return
    
    # Skip lock files
    [[ "$file" == *"package-lock.json"* ]] && return
    [[ "$file" == *"yarn.lock"* ]] && return
    
    # Skip files larger than MAX_SIZE
    local filesize=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    if [ "$filesize" -gt "$MAX_SIZE" ]; then
        echo "   ⚠️ Skipping large file: $file"
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

# 1. Capture Specific Root Text/SQL files
echo "📑 Processing Database and Root Docs..."
for f in kulasql.txt README.md; do
    [ -f "$f" ] && append_file "$f"
    done
    
    # 2. Smart Find for Source Code
    # Extensions: .sol, .js, .ts, .tsx, .jsx, .mjs, .css, .json, .sh
    # Exclusions: node_modules, .next, .expo, artifacts, public/assets, git, cache
    echo "💻 Processing Code (Contracts, Frontend, Mobile, Middleware)..."
    find . -type f \
    \( \
    -name "*.sol" -o \
    -name "*.js" -o \
    -name "*.ts" -o \
    -name "*.tsx" -o \
    -name "*.jsx" -o \
    -name "*.mjs" -o \
    -name "*.css" -o \
    -name "*.sh" -o \
    -name "*.json" \
    \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.next/*" \
    -not -path "*/.expo/*" \
    -not -path "*/artifacts/*" \
    -not -path "*/cache/*" \
    -not -path "*/public/assets/*" \
    -not -path "*/.git/*" \
    -not -name "package-lock.json" \
    -not -name "kula_all_code.txt" \
    | sort | while read -r file; do
    append_file "$file"
    done
    
    echo ""
    echo "✅ Done! All relevant code aggregated into: $OUTPUT_FILE"
    echo "Total size: $(du -h "$OUTPUT_FILE" | cut -f1)"
